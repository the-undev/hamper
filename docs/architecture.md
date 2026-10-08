# Architecture

How hamper is built. The shape is skarrow's, without Aspire, with sync and a
PWA added.

## Stack

| Part | Choice |
| --- | --- |
| API | C# / .NET 10, ASP.NET Core minimal APIs, vertical slices, problem+json errors |
| Database | SQLite through EF Core, migrations in the repo |
| Frontend | React 19, TypeScript strict, Vite, Tailwind CSS v4, shadcn, TanStack Router and Query, dnd-kit, pnpm, Biome, Vitest |
| On-device store | Dexie (IndexedDB) |
| Real time | Server-sent events |
| PWA | Web app manifest and a service worker for the app shell and viewed images; tooling `TBD` |
| Images | Cropped on the phone with a canvas, resized on the server; library `TBD` (Magick.NET as in skarrow, or ImageSharp) |
| Tests | Integration through a `WebApplicationFactory` against a real SQLite file, never a mocked database; Vitest for the frontend |

One process: the API serves the built frontend from `wwwroot`. One `/data`
volume holds `hamper.db` and `images/`.

Time goes through `TimeProvider` and file IO through one storage seam, both
analyzer-enforced, as in skarrow.

## Layout

```
backend/   Hamper.slnx: src/Hamper.Api, tests/Hamper.Api.Tests
frontend/  Vite + React, pnpm
docs/
Dockerfile
Makefile   setup, dev, live-test, check, image
```

`make check` runs build, format, backend tests, lint, typecheck, frontend
tests and the frontend build. Nothing merges without it.

### Ports

| What | Port |
| --- | --- |
| API, dev | 8776 |
| Vite dev server, proxies `/api` and `/sync` to the API | 5276 |
| Vite preview | 4276 |
| API, live test (own database and data dir) | 8777 |
| Container | 8080 |

Chosen clear of skarrow (8766, 5273, 4273, 8767, 8768) and the legacy app
(8765, 5173) on the same machine.

## Sync

Every device holds the whole synced dataset and a queue of changes not yet
sent. The server is the source of truth.

### What is synced

Items, meals and their lines, the plan with its days, planned meals and
wanted lines, and open shops with their lines. History and images are not.

### Revisions and tombstones

Every synced table has `revision`, a server-assigned integer from one
sequence shared by all tables, and `deleted_at`. A write sets a new revision;
a delete sets `deleted_at` and a new revision and the row stays. A client
asks for everything after the last revision it saw, so one cursor covers
every table.

### Pull

`GET /sync?since=<revision>` returns every row of every synced table with a
revision above `since`, deleted rows included, and the server's current
revision. The client upserts them into Dexie and stores the cursor. With
`since=0` it is the initial load; the dataset is small enough for this to be
one request.

### Push

`POST /sync` takes a batch of row changes from the outbox, each with the
table, the row id, the fields, and the client's own change id. The server
applies them in order, assigns revisions, and returns the rows as they now
stand plus the new current revision. The client clears the acknowledged
outbox entries and upserts the returned rows.

Conflicts: last writer wins per row, by order of arrival at the server. The
cases that matter here (two people ticking, renaming, adding) are all fine
with that, and a delete racing an edit resolves to whichever arrived last.
Counts are set, not incremented, so two people pressing + at once leave the
count one higher, which is accepted.

Row ids are UUIDs made on the client, so a row created offline has its id
before the server sees it.

### Live updates

`GET /sync/events` is an SSE stream. The server sends the new current
revision after every write. A client that receives a revision above its
cursor pulls. Reconnection is the browser's; on reconnect the client pulls
once, which covers anything missed.

### On the device

Dexie holds one table per synced table plus `outbox` and `meta` (the cursor).
Reads go through TanStack Query backed by Dexie live queries, so a screen
re-renders when the store changes, whether from the user or from a pull.
Writes go to Dexie and to the outbox in one transaction, then a sync loop
drains the outbox when online and pulls on every SSE revision, on reconnect,
and on app focus.

Offline is `navigator.onLine` plus the last push or pull failing. The status
bar shows it, and the size of the outbox.

## Images

An item or meal has at most one image. The client opens the camera or the
photo picker, shows a crop box, and uploads the cropped image as JPEG.
`POST /items/{id}/image` and `POST /meals/{id}/image` take it; the server
resizes to two fixed sizes, a thumbnail for lists and a larger one for the
meal screen, and stores both under `/data/images/<id>/`. The database holds
the image's id and sizes. `GET /images/<id>/<size>` serves them with long
cache headers, and the service worker caches responses it has seen.

## Export and import

`GET /export` streams a zip: `data.json` holding every table including
history, and `images/`. `POST /import` takes the same zip into an empty
database and refuses a database that already has data. The JSON carries a
format version.

## Share and download

Share builds the unticked lines as text on the device and calls
`navigator.share`. Where that is absent, it copies to the clipboard and says
so. Download writes the same text to a `.txt` file through a blob link. Both
work offline.

## PWA

A manifest with the name, icons and `display: standalone`. The service worker
precaches the app shell on install, so the app opens with no connection, and
caches image responses as they are seen. API and sync requests are never
cached by it; the data lives in Dexie.

The service worker and `navigator.share` need a secure context, so they are
present on the HTTPS address and absent on the plain HTTP one; the app detects
each and hides what is absent. See [deployment](deployment.md).

## Identity

None. There are no accounts and nothing records who made a change. Reaching
the app is decided by the network it is on.
