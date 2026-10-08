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

`make image` builds it locally, `VERSION=x.y.z` stamps it.

A GitHub Actions workflow builds the image on a version tag and pushes it to
`ghcr.io/the-undev/hamper:<version>` and `:latest`. The package is public, so
a host pulls it with no login.

## What the host provides

- A directory mounted at `/data`. Everything mutable is in it: the database
  and the images. Back that directory up and the instance can be rebuilt.
- A port mapped to `8080`.
- A network that reaches nothing else. hamper calls no other service.
- The process runs as whatever user the host assigns; files under `/data`
  are owned by that user.

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

`GET /health` answers `{"status":"ok"}` with no login, for a keyword monitor.

## Development

`make dev` runs the API on 8776 and Vite on 5276 against the developer's own
database in the checkout. `make live-test` runs the API alone on 8777 with its
own database and data directory for manual checks, and never touches the dev
database. Neither is reachable from a phone by default, so sync and PWA
behaviour are tested on a phone against the live-test instance over the local
network or through a dev tunnel, `TBD`.
