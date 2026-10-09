# Deployment

How hamper is built into an image and what it needs of the host that runs it.
Host-specific values, addresses, ports, paths and the proxy in front of it,
belong in the operator's own notes, never here.

## The image

`Dockerfile` builds the frontend with Node and pnpm, publishes the API with the
.NET SDK, and assembles both into an `aspnet` runtime image with the frontend
in `wwwroot`. The image listens on `8080`, declares `/data` as its volume and
takes two optional variables, `PUID` and `PGID`.

| Setting | Value in the image |
| --- | --- |
| `ASPNETCORE_URLS` | `http://+:8080` |
| `ConnectionStrings__Hamper` | `Data Source=/data/hamper.db` |
| `Storage__DataDir` | `/data` |
| `PUID` | Unset. The uid the process runs as, set together with `PGID`. |
| `PGID` | Unset. The gid the process runs as, set together with `PUID`. |

The entrypoint, `docker/entrypoint.sh`, starts the command in `CMD`. With
`PUID` and `PGID` unset it runs it as the user that started the container.
With both set it gives `/data` and everything in it to that uid and gid,
exports `HOME=/data`, and runs the command as them through `setpriv`. Setting
one without the other stops the container with an error.

`make image-check` builds the image and runs it twice on `127.0.0.1:18090`,
each time with a fresh data directory: once with `PUID=99` and `PGID=100`, once
with neither. It checks that `/health` answers ok, that the process runs as the
expected uid, and who owns `hamper.db`. The CI workflow runs it as the `image`
job.

The build takes two arguments, `VERSION` and `INFORMATIONAL_VERSION`, which
stamp the API assembly's version and informational version. Both default to
`0.0.0-dev`.

`make image` builds it locally as `hamper:0.0.0-dev`. `make image
VERSION=x.y.z` builds `hamper:x.y.z`, stamped `x.y.z` and `x.y.z+<short sha>`.

The Release workflow, `.github/workflows/release.yml`, runs when a `v*` tag is
pushed. It runs the CI workflow against the tagged commit as its gates, then
builds the image with the same two stamps, the version being the tag without
its `v`. It pushes the image to `ghcr.io/the-undev/hamper:<version>` and
`:latest`, logging in with the workflow's `GITHUB_TOKEN`. A version with a `-`
in it, such as `1.0.0-rc.1`, is a prerelease and publishes without `:latest`.
If the first publish leaves the package private, making it public in its GitHub
settings lets a host pull it with no login.

The Publish edge workflow, `.github/workflows/publish-edge.yml`, runs on every
push to `main` and when started by hand on any branch. It runs the CI workflow
as its gates, then builds the image stamped `0.0.0-edge` and
`0.0.0-edge+<short sha>`. It pushes three tags: `:edge`, `:sha-<short sha>` and
`:<branch>`. `:edge` is set only on `main`, so it always points at the newest
`main`. The CI workflow does not run on its own push trigger for `main`, so
each push to `main` runs the gates once, inside this workflow. A manual run
on a branch publishes that branch's `:<branch>` and `:sha-<short sha>` and
leaves `:edge` alone.

## Running it

```
docker run -d --name hamper -v <dir>:/data -p <port>:8080 ghcr.io/the-undev/hamper:latest
```

Use `:edge` to follow `main`. Use `:latest` or a version tag to stay put until
the next release.

Once it is up, `GET /health` on the mapped port answers `{"status":"ok"}`, or a
503 problem when the database cannot be reached. The first start creates
`hamper.db` in `<dir>`.

## Unraid

`hamper-edge` runs `:edge`, which follows the newest `main` and is for trying
changes. The stable container runs `:latest` and holds the household's data.

To create `hamper-edge`:

1. On the Docker tab, choose Add Container and turn Advanced View on.
2. Set Name to `hamper-edge`, Repository to `ghcr.io/the-undev/hamper:edge`,
   Network Type to bridge, and WebUI to `http://[IP]:[PORT:8080]/`.
3. Set Icon URL to
   `https://raw.githubusercontent.com/the-undev/hamper/main/frontend/public/icon-192.png`.
4. Add a Port mapping from a host port (`8781` by default) to container port
   `8080`, TCP.
5. Add a Path mapping from `/mnt/user/appdata/hamper-edge` to `/data`, read
   and write.
6. Add a Variable with Key `PUID` and Value `99`, Unraid's `nobody`.
7. Add a Variable with Key `PGID` and Value `100`, Unraid's `users`.
8. Choose Apply.
9. Open `/health` on the host port. It answers ok.

The stable container is the same with `:latest`, its own appdata folder and
its own host port (`8780` by default).

`unraid/hamper.xml` and `unraid/hamper-edge.xml` hold the same settings in
Unraid's template form, for reference.

The package must be public, or Unraid cannot pull it without a login. Change
that in the package's settings on GitHub.

The ports, `8780` and `8781`, are defaults the operator changes to suit the
host. To update `hamper-edge`, use Docker, then Check for Updates, then apply
the update. A restart alone does not pull the new image.

## What the host provides

- A directory mounted at `/data`. Everything mutable is in it: the database
  and the images. Back that directory up and the instance can be rebuilt.
- A port mapped to `8080`.
- A network that reaches nothing else. hamper calls no other service.
- The process runs as root unless `PUID` and `PGID` are set. With both set,
  the entrypoint, which starts as root, gives `/data` to that uid and gid and
  runs the process as them, so files under `/data` are owned by the host's
  user. That suits hosts whose integrations need a root entrypoint.

## HTTPS

Offline use, home screen install and the share sheet are refused by browsers
on a plain `http://` address, so the app needs an HTTPS address to give the
full set. How that is provided is the host's choice: a reverse proxy with a
certificate, or a mesh VPN's own HTTPS proxy such as Tailscale Serve. The
proxy terminates TLS and forwards plain HTTP to `8080`; the app knows nothing
about certificates.

The plain HTTP address keeps working at the same time: viewing, editing and
live updates, without offline, install or share. The app detects which it has
and hides what is absent.

## Monitoring

A keyword monitor watches `/health` for `ok`. It needs no login.

The production log carries only warnings and errors from EF Core's SQL
commands. Development logs every command.

## Development

`make setup` restores the .NET packages and installs the frontend's. `make dev`
runs the API on `localhost:8776` and Vite on 5276 against the developer's own
database and data directory in the checkout. `make live-test` runs the API
alone on `127.0.0.1:8777` with its own database and data directory under
`/tmp/hamper-live-test`, which `LIVE_TEST_DIR` moves, for manual checks, and
never touches the dev database. `make check` runs every gate. `make e2e`
builds the frontend, starts the API on `127.0.0.1:8778` with its own temp
database, data directory and the build as its web root, and runs the
Playwright suite against it: a phone and a desktop in Chromium, and a desktop
in Firefox. It needs both browsers, installed once with
`pnpm -C frontend exec playwright install chromium firefox`. Neither instance
is reachable from a phone by default, so sync and PWA behaviour are tested on a
phone against the live-test instance over the local network or through a dev
tunnel, `TBD`.
