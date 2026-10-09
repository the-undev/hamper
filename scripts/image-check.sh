#!/bin/sh
# Runs the image as Unraid's nobody:users and as root, checking /health, the process uid and who owns the database.
# Usage: scripts/image-check.sh <image>
set -eu

image="$1"
port=18090
container="hamper-image-check-$$"
work="$(mktemp -d)"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  # The files belong to the container's user, so the image hands them back before the host removes them.
  docker run --rm -v "$work:/work" --entrypoint chown "$image" -R "$(id -u):$(id -g)" /work >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
trap 'exit 1' INT TERM

fail() {
  echo "image-check: FAIL: $1" >&2
  echo "image-check: container log:" >&2
  docker logs "$container" 2>&1 | sed 's/^/  /' >&2 || true
  exit 1
}

# Starts the image on a fresh data directory named $1, with the remaining arguments passed to docker run, and waits for /health.
start() {
  data="$work/$1"
  shift
  mkdir -m 755 "$data"
  docker run -d --name "$container" -p "127.0.0.1:$port:8080" -v "$data:/data" "$@" "$image" >/dev/null
  waited=0
  body=""
  until echo "$body" | grep -q '"status":"ok"'; do
    [ "$waited" -lt 30 ] || fail "/health did not answer ok within 30 s; last answer: '$body'"
    sleep 1
    waited=$((waited + 1))
    body="$(curl -s "http://127.0.0.1:$port/health" || true)"
  done
  echo "image-check: $data: /health answered $body after ${waited} s"
}

# Fails unless PID 1 in the container runs as uid $1.
expect_process_uid() {
  seen="$(docker exec "$container" stat -c %u /proc/1)"
  command="$(docker exec "$container" cat /proc/1/comm)"
  [ "$seen" = "$1" ] || fail "PID 1 ($command) runs as uid $seen, expected $1"
  echo "image-check: PID 1 ($command) runs as uid $seen"
}

# Fails unless the database in the current data directory is owned by $1 (uid:gid).
expect_database_owner() {
  seen="$(stat -c %u:%g "$data/hamper.db")"
  [ "$seen" = "$1" ] || fail "hamper.db is owned by $seen, expected $1"
  echo "image-check: hamper.db is owned by $seen"
}

start as-host-user -e PUID=99 -e PGID=100
expect_process_uid 99
expect_database_owner 99:100
docker rm -f "$container" >/dev/null

start as-root
expect_process_uid 0
expect_database_owner 0:0
docker rm -f "$container" >/dev/null

echo "image-check: passed"
