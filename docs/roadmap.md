# Roadmap

Work identified and not done, and decisions still open. Each has its own
heading so a document can link to it.

## Build order

1. Repo skeleton: backend, frontend, Makefile, Dockerfile, `make check` green
   on an empty app.
2. Domain and API: items, meals, plan, shops, history, export and import, with
   integration tests.
3. Sync: revisions, pull, push, SSE, the Dexie store and the outbox.
4. Screens: Plan, Shop, Meals, More, against the synced store.
5. Images: crop, upload, resize, serve.
6. PWA: manifest, service worker, share, download.
7. Release workflow, image on ghcr, the container on the server.

## Open decisions

### Image library

Magick.NET, which skarrow uses, or ImageSharp. Resizing JPEGs is all that is
needed. `TBD`.

### PWA tooling

`vite-plugin-pwa` with Workbox, or a hand-written service worker. The shell
precache and an image cache are small enough for either. `TBD`.

### Published port

Chosen when the container is added, from what is free on the server.

### Export schedule

The host's backup covers `/data`. Whether to also take an export on a
schedule, and where to put it, is undecided.

### Testing sync from a phone

The dev and live-test instances are on the developer's machine. A phone needs
to reach one over the LAN, or through a dev tunnel, to exercise offline and
install before a release.

## Parked

### Presets

Named sets of meals ("Week A", "Week B") and of items, applied to the plan in
one action. Copying meals from a past week in history covers most of it. Add
if the library of past weeks is not enough.

### Reconcile an open list after the plan changes

When the plan is edited after a list was made from it, offer to bring the
list up to date without losing the edits made on the list. Today the answer
is to delete the list and generate again.

### Notes on a line

Free text on a shop line, or a size override on a plan line, for "small bag
this time". Today the shop line's size is edited instead.

### HTTPS on the home network

A reverse proxy on the host with a certificate for a local name would give
every device on the local network the full app without a VPN. It is a host
change, not an app change; only the address moves.

### Who changed what

A proxy that knows who is connecting can pass the name in a request header
(Tailscale Serve does, for example). Recording it against changes would give
"added by" with no login. Decided against for now.

### Permissions

None exist. If they are ever wanted, the proxy identity above is the
starting point.

### Recipes

Method, servings, timings. Out of scope by design; see
[principles](principles.md). Revisit only if the household asks.

### Voice

The voice assistant's list is what "add beans" goes to today. A way to add to
the wanted list by voice would close that gap. No route known yet.
