#!/bin/sh
# Runs the command as PUID:PGID when both are set, otherwise as the user that started the container.
set -eu

puid="${PUID:-}"
pgid="${PGID:-}"

# Neither set: run as the current user, which is root unless the host passed --user.
if [ -z "$puid" ] && [ -z "$pgid" ]; then
  exec "$@"
fi

# One set without the other: refuse rather than guess.
if [ -z "$puid" ] || [ -z "$pgid" ]; then
  echo "hamper: set both PUID and PGID, or neither (PUID='$puid', PGID='$pgid')" >&2
  exit 1
fi

# Both set: give /data to that user, changing only entries it does not already own, then drop to it.
find /data \( ! -user "$puid" -o ! -group "$pgid" \) -exec chown -h "$puid:$pgid" {} +
export HOME=/data
exec setpriv --reuid="$puid" --regid="$pgid" --clear-groups -- "$@"
