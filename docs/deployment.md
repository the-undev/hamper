# Deployment

How hamper is built into an image and what it needs of the host that runs it.
Host-specific values, addresses, ports, paths and the proxy in front of it,
belong in the operator's own notes, never here.

## The image

`Dockerfile` builds the frontend with Node and pnpm, publishes the API with the
.NET SDK, and assembles both into an `aspnet` runtime image with the frontend
in `wwwroot`. The image listens on `8080`, declares `/data` as its volume and
takes nothing else.

| Setting | Value in the image |
| --- | --- |
| `ASPNETCORE_URLS` | `http://+:8080` |
| `ConnectionStrings__Hamper` | `Data Source=/data/hamper.db` |
| `Storage__DataDir` | `/data` |

The build takes two arguments, `VERSION` and `INFORMATIONAL_VERSION`, which
stamp the API assembly's version and informational version. Both default to
`0.0.0-dev`.

`make image` builds it locally as `hamper:0.0.0-dev`. `make image
VERSION=x.y.z` builds `hamper:x.y.z`, stamped `x.y.z` and `x.y.z+<short sha>`.

The Release workflow, `.github/workflows/release.yml`, runs when a `v*` tag is
pushed. It runs the CI workflow against the tagged commit as its gates, then
builds the image with the same two stamps, the version being the tag without
its `v`. It pushes the image to `ghcr.io/the-undev/hamper:<version>` and
`:latest`, logging in with the workflow's `GITHUB_TOKEN`. If the first publish
leaves the package private, making it public in its GitHub settings lets a
host pull it with no login.

## Running it

```
docker run -d --name hamper -v <dir>:/data -p <port>:8080 ghcr.io/the-undev/hamper:latest
```

Once it is up, `GET /health` on the mapped port answers `{"status":"ok"}`, or a
503 problem when the database cannot be reached. The first start creates
`hamper.db` in `<dir>`.

## What the host provides

- A directory mounted at `/data`. Everything mutable is in it: the database
  and the images. Back that directory up and the instance can be rebuilt.
- A port mapped to `8080`.
- A network that reaches nothing else. hamper calls no other service.
- The image sets no user, so the process runs as root unless the host
  passes one with `--user`. Files under `/data` are owned by the user it runs
  as.

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

## Development

`make setup` restores the .NET packages and installs the frontend's. `make dev`
runs the API on `localhost:8776` and Vite on 5276 against the developer's own
database and data directory in the checkout. `make live-test` runs the API
alone on `127.0.0.1:8777` with its own database and data directory under
`/tmp/hamper-live-test`, which `LIVE_TEST_DIR` moves, for manual checks, and
never touches the dev database. `make check` runs every gate. Neither instance
is reachable from a phone by default, so sync and PWA behaviour are tested on a
phone against the live-test instance over the local network or through a dev
tunnel, `TBD`.
