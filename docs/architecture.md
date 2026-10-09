# Architecture

How hamper is built. The shape is skarrow's, without Aspire, with sync and a
PWA added.

## Stack

| Part | Choice |
| --- | --- |
| API | C# / .NET 10, ASP.NET Core minimal APIs, vertical slices, problem+json errors |
| Database | SQLite through EF Core (`Microsoft.EntityFrameworkCore.Sqlite`), migrations in the repo |
| Frontend | React 19, TypeScript strict, Vite, Tailwind CSS v4, TanStack Router and Query, pnpm, Biome |
| Components | shadcn's AlertDialog, Badge, Button, Checkbox, Command (cmdk), Dialog, Input, Label, Popover, Sheet, Sonner and Tabs, on Radix UI, with lucide-react icons |
| Drag and drop | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| On-device store | Dexie (IndexedDB), read through `dexie-react-hooks` live queries |
| Real time | Server-sent events |
| PWA | `vite-plugin-pwa` with Workbox in `generateSW` mode, and `workbox-window` under its register module: the web app manifest, and a service worker for the app shell and viewed images |
| Images | Cropped on the phone with a canvas, resized on the server with Magick.NET (`Magick.NET-Q8-AnyCPU`, Apache 2.0) |
| Tests | Backend: xUnit v3, integration through a `WebApplicationFactory` against a real SQLite file, never a mocked database, with `FakeTimeProvider`. Frontend: Vitest, Testing Library, jsdom and `fake-indexeddb`; a screen re-renders a few ticks after a write commits, so a test waits for the screen to show one write before an action that reads it. Browser: Playwright as a phone and a desktop in Chromium, and as a desktop in Firefox, against the API serving the built frontend on 8778 with its own temp database, run by `make e2e`; it covers the journeys in [screens](screens.md), live sync between two browsers, offline edits, swipes and drags by finger and mouse, pictures, export and import, and the service worker |

One process: the API serves the built frontend from `wwwroot`. One `/data`
volume holds `hamper.db` and `images/`.

Time goes through `TimeProvider` and file IO through one storage seam,
`IFileStorage`, both enforced by `Microsoft.CodeAnalysis.BannedApiAnalyzers`,
as in skarrow.

## Layout

```
backend/   Hamper.slnx: src/Hamper.Api, tests/Hamper.Api.Tests
frontend/  Vite + React, pnpm; e2e/ holds the Playwright suite
docs/
Dockerfile
Makefile   setup, dev, live-test, check, e2e, image
.github/workflows/   ci.yml (the gates), release.yml (the image on a v* tag)
```

`make check` runs build, format, backend tests, lint, typecheck, frontend
tests and the frontend build, which fails when it emits no `sw.js` or
`manifest.webmanifest`. Nothing merges without it. `make e2e` runs the
browser suite; it runs before a merge and in CI.

### Ports

| What | Port |
| --- | --- |
| API, dev | 8776 |
| Vite dev server, proxies `/api`, `/sync` and `/images` to the API | 5276 |
| Vite preview | 4276 |
| API, live test (own database and data dir) | 8777 |
| API, browser tests (own temp database and data dir) | 8778 |
| Container | 8080 |

Chosen clear of skarrow (8766, 5273, 4273, 8767, 8768) and the legacy app
(8765, 5173) on the same machine.

## API

Every endpoint lives under `/api` except `/health`, the `/sync` endpoints and
`/images`, which the service worker treats differently from API calls. An
unknown path under `/api`, `/sync` or `/images` is a problem+json 404; any
other unknown path gets the app shell.

- `GET /health`: the status for a monitor.
- `POST /api/shops/{id}/archive`: copies an open shop into history and
  tombstones it.
- `GET /api/history`: archived shops, newest first, with a line count.
- `GET /api/history/{id}`: one archived shop with its lines.
- `GET /api/export`: the export zip.
- `POST /api/import`: takes an export zip into an empty database.
- `POST /api/items/{id}/image`, `POST /api/meals/{id}/image`: store a new
  picture for the row. See [Images](#images).
- `DELETE /api/items/{id}/image`, `DELETE /api/meals/{id}/image`: clear the
  row's picture.
- `GET /images/{imageId}/{size}`: one size of an image.
- `GET /sync?since=<revision>`: every synced row written after the cursor,
  and the current revision. See [Pull](#pull).
- `POST /sync`: applies a batch of row changes and returns the rows as they
  now stand. See [Push](#push).
- `GET /sync/events`: a server-sent event stream of the current revision.
  See [Live updates](#live-updates).

## Sync

Every device holds the whole synced dataset and a queue of changes not yet
sent. The server is the source of truth.

### Where the rules run

The rules in [domain](domain.md) run on the device against its store, so
every edit works offline. The server validates rows, assigns revisions, and
runs what needs history or the file system: archive, history, export, import
and images.

### What is synced

Items, meals and their lines, the plan with its planned meals, their lines
and the extras lines, and open shops with their lines. History and images are not.

### Revisions and tombstones

Every synced table has a revision and a deleted-at column (`Revision` and
`DeletedAt` in the database, `revision` and `deletedAt` on the wire). The
revision is a server-assigned integer from one sequence shared by all tables.
A write sets a new revision; a delete sets `deletedAt` and a new revision and
the row stays. A client asks for everything after the last revision it saw,
so one cursor covers every table.

Revisions come from one counter in `sync_state`, assigned on save. Writes are
serialised in the process, so revisions commit in the order they were
assigned.

### On the wire

The tables are `items`, `meals`, `mealLines`, `plan`, `plannedMeals`,
`plannedMealLines`, `wantedLines`, `shops` and `shopLines`, the database
tables in camelCase. A row is a JSON object holding every column in camelCase,
`revision` and `deletedAt` included; `deletedAt` is null on a live row. Dates
are `yyyy-MM-dd` and timestamps ISO 8601 with an offset. A shop's `meals` and
a shop line's `sources` are JSON arrays. Each entry of `meals` is
`{ "position", "rank", "name", "mealId" }`.

A planned meal row carries the day's `position` and its `rank`, its place in
that day's order from 0.

The plan row's id is fixed at `5e1f0a3c-9b2d-4c47-8a61-2f3d4b5c6a70`.

### Pull

`GET /sync?since=<revision>` returns the server's current revision and every
row of every synced table with a revision above `since`, deleted rows
included. `since` defaults to 0, and a negative one is a 400 problem.

```json
{ "revision": 42, "items": [], "meals": [], "mealLines": [], "plan": [],
  "plannedMeals": [], "plannedMealLines": [], "wantedLines": [], "shops": [],
  "shopLines": [] }
```

Every table key is present, empty or not, and `plan` holds zero or one row.
The read runs in one transaction, so the response is one snapshot and no row
in it has a revision above the one it reports.

The client upserts the rows into Dexie and stores the revision as its
cursor. With `since=0` it is the initial load; the dataset is small enough
for this to be one request.

### Push

`POST /sync` takes a batch of changes from the outbox, each with the
client's own change id:

```json
{ "changes": [ { "id": "c1", "table": "items", "row": { "id": "...", "deletedAt": null, "name": "Milk", "size": null } } ] }
```

A change carries the whole row as the client holds it: every column except
`revision`, with `deletedAt` set for a delete. The server applies the batch
in order as one transaction. Each row is inserted, or replaces every column
but the revision of the stored row with its id, and a changed row takes a
new revision. Foreign keys are checked at commit, so a row may point at one
that arrives later in the same batch.

Every change is validated before anything is written. The first failure
rejects the whole batch with a 400 problem whose detail names the change and
the reason:

- an unknown table;
- a missing or malformed row id;
- a row that does not fit its table: a column missing or of the wrong type,
  or a property the table does not have;
- a name empty after trimming, or longer than its maximum (items, meals and
  planned meals 200, an item's size 100);
- a count below 1;
- a plan `lengthDays` outside 1 to 31, or a plan row with another id;
- a planned meal with a negative position or rank;
- a foreign key that points at no row once the batch is applied.

The response holds the current revision after the batch, the applied change
ids, and the pushed rows as they now stand under every table key:

```json
{ "revision": 57, "applied": ["c1"], "rows": { "items": [], "meals": [], ...,
  "shopLines": [] } }
```

An empty batch returns the current revision and empty lists.

The client clears the applied outbox entries and upserts the returned rows.
The push does not move its cursor, because other writes may have taken
revisions between the cursor and the batch. The client pulls after a push;
the live update's revision is above its cursor, which prompts the pull.

Conflicts: last writer wins per row, by order of arrival at the server. The
cases that matter here (two people ticking, renaming, adding) are all fine
with that, and a delete racing an edit resolves to whichever arrived last.
Counts are set, not incremented, so two people pressing + at once leave the
count one higher, which is accepted.

Row ids are UUIDs made on the client, so a row created offline has its id
before the server sees it.

### Live updates

`GET /sync/events` is a server-sent event stream: `text/event-stream`,
`Cache-Control: no-cache`, unbuffered. It sends a `revision` event with the
current revision on connect, and again after every unit of work through the
write gate has finished:

```
event: revision
data: 57
```

A unit of work that wrote nothing sends the unchanged revision, which the
client ignores. A client that falls behind receives only the newest
revision. A comment line, `: keepalive`, goes out every 15 seconds so an idle
connection stays open.

A client that receives a revision above its cursor pulls. Reconnection is the
browser's; on reconnect the client pulls once, which covers anything missed.

### On the device

Dexie holds a database named `hamper` with one table per synced table, keyed
on `id` and indexed on the foreign keys `mealId`, `plannedMealId`, `shopId`
and `itemId`, with planned meals also indexed on `position`, plus `outbox` and
`meta`. A row the server has not yet seen has
revision 0.

The outbox holds one entry per changed row: `seq` (its place in the queue),
`table`, `rowId` and `dirtiedAt`. Changing a row already in the outbox keeps
its place and moves `dirtiedAt`. `meta` holds the sync cursor under `cursor`.

Every edit runs as one Dexie transaction over every synced table and the
outbox, so a row and its outbox entry are written together or not at all. A
fact the server already holds, such as a new `imageId`, is patched into the
row without the outbox. The rules in [domain](domain.md) are operations inside
such a transaction. The server makes the plan row, so an operation on the plan
refuses until the first pull has brought it.

Screens read the store through Dexie live queries, so a screen re-renders
when the store changes, whether from the user or from a pull. A screen writes
by running domain operations inside one `write` transaction; a refused
operation shows its reason and changes nothing. TanStack Query serves only REST
calls, such as history and the image upload.

The app opens the store and makes one sync loop at start, and provides both
to every screen; the loop runs while the app is mounted.

The loop pushes and then pulls, one run at a time. A request to sync
while a run is going queues one more run.

The push reads the outbox in `seq` order and sends one change per entry: the
row as it stands, without its revision, under the entry's `seq` as the
change id. When the server applies the batch, the loop deletes each applied
entry whose `dirtiedAt` has not moved since the batch was read, and upserts
each returned row that is not still in the outbox. A row changed while its
push was in flight stays in the outbox for the next batch. A 400 keeps the
outbox and reports the problem's title; the batch is sent again on the next
run.

The pull asks for every row above the cursor, upserts each row that is not
in the outbox, and stores the returned revision as the cursor. Only the pull
moves the cursor. A pull follows every push, a refused one included.

The loop syncs when the event stream opens or reopens, on a `revision` event
above the cursor, when the browser comes online, when the app comes back
into focus or view, and 300 ms after a local write while online. Firefox
leaves an event stream closed when it fails offline, so on the online, focus
and visibility triggers, and after a closing error while online, the loop
replaces a closed stream with a new one; a connecting or open stream is kept.

Offline is `navigator.onLine` false, or the last push, pull or event stream
failing to reach the server. The loop's status holds that, the size of the
outbox, when the last sync finished and the last problem the server
reported, and whether a push and pull are running. The header's sync slot
shows offline, sending, or the count waiting; the More screen shows the rest.

## Images

An item or meal has at most one image, named by the `imageId` column on its
row, null when it has none. The column syncs like any other; the files do not.

`POST /api/items/{id}/image` and `POST /api/meals/{id}/image` take the
picture as the raw request body, `image/jpeg`, `image/png` or `image/webp`,
at most 10 MB. Inside the write gate the server checks the row is live, makes
a new image id, and writes two JPEGs with Magick.NET, oriented from the EXIF
data and then stripped of it, at quality 82:

| Size | File | Shape |
| --- | --- | --- |
| `thumb` | `<data>/images/<imageId>/thumb.jpg` | 240 by 240, scaled to fill and cropped to the centre |
| `large` | `<data>/images/<imageId>/large.jpg` | at most 1200 on the longer edge, never enlarged |

It then sets the row's `imageId`, which gives the row a new revision, deletes
the previous image's directory, and returns `{ "imageId": "..." }`. A missing
or deleted row is a 404 problem, another media type a 415, a body over 10 MB
a 413, and a body Magick cannot read as the media type a 400, "Not an image".

`DELETE` on the same paths clears `imageId`, deletes the files and returns
204; a row with no image returns 204 and is not written.

`GET /images/{imageId}/{size}`, `size` being `thumb` or `large`, serves the
file as `image/jpeg` with `Cache-Control: public, max-age=31536000,
immutable`. An image id never changes its content; a new picture gets a new
id. An unknown image, size or path under `/images` is a problem+json 404. The
service worker caches responses it has seen.

On the device, Change photo opens a file input that accepts `image/*`, so the
phone offers the camera or the library. The picture is drawn on a canvas in a
square crop box: dragging pans it, and a slider zooms from the size that just
covers the box to three times that. Use photo draws the crop at 1200 by 1200
and sends it as a JPEG through a TanStack Query mutation. The device syncs
before the upload, so the server has a row made offline. It then patches the
returned `imageId` into its own copy of the row and syncs again, so a change to
the row still waiting to be sent carries the new id. Remove photo calls the
delete and patches in a null `imageId` the same way. Both need the server and are
disabled while offline.

A picture shows the `thumb` in lists, on meal cards and on the plan, and the
`large` on the meal screen. A planned meal shows the picture of the library
meal it came from. With no image, or when the request fails, offline with nothing
cached for example, the placeholder shows instead: a coloured block with the
name's first letter.

## Export and import

`GET /api/export` returns a zip named `hamper-<yyyyMMdd-HHmmss>.zip` holding
`data.json`: format 2, the plan's start date and length, every live row of
the synced tables without revisions under the wire names (`plannedMeals` and
`plannedMealLines` among them), and all of history. Each row carries
`deletedAt`, null for a live row. A deleted item or meal that an exported row
still points at is exported as a tombstone, so every reference resolves on
import, where it stays deleted. Beside `data.json`, the zip holds
`images/<imageId>/thumb.jpg` and `images/<imageId>/large.jpg` for every
exported item and meal with an image whose files exist.

`POST /api/import` takes the same zip as the raw request body
(`application/zip`) and writes it in one transaction: every row as it comes,
`deletedAt` included, with new revisions, and the plan's start date and
length. It refuses with 409 when any item, meal, planned meal, extras line,
shop or archived shop exists, deleted ones included, and with 400 when the
body is not a zip, the zip has no `data.json`, the format is not 2, or the
JSON does not fit the schema. Import writes each image's two files from the zip into the
data directory. A row whose `imageId` lacks either file in the zip is imported
with `imageId` cleared.

## Share and download

Share builds the unticked lines as text on the device and calls
`navigator.share`. Where that is absent, it copies to the clipboard and says
so. Share shows only on a secure context. Download writes the same text to a
`.txt` file through a blob link, on any address. Both work offline.

## PWA

The manifest, built by the plugin from `frontend/src/pwa/manifest.ts`, names
the app `hamper`, opens `/` with `display: standalone`, and takes its theme
and background colours from the light theme's `--accent` and `--background`.
Its icons are `frontend/public/icon.svg` rasterised once to `icon-192.png`
and `icon-512.png`, and to `icon-maskable-512.png` with the corners filled.
`index.html` carries the same theme colour and `icon-192.png` as the Apple
touch icon.

Workbox builds the service worker in `generateSW` mode. It precaches
`index.html`, every script and stylesheet under `assets/`, the icons and the
manifest, so the app opens with no connection. A navigation is answered with
the cached `index.html`, except under `/api/`, `/sync/`, `/images/` and
`/health`, which go to the network. Responses under `/images/` are cached as
they are seen, cache first, in a cache named `images` that keeps at most 300
entries for at most 60 days. Nothing else is cached by it: API and sync
requests go to the network, and the data lives in Dexie. The worker is built
only by `vite build`; `make dev` runs without one.

`frontend/src/pwa/register.ts` registers the worker through
`virtual:pwa-register` with the prompt register type. When a new version has
installed and waits, a toast shows Update ready with a Reload action, which
activates the new worker and reloads the page. The toast stays until it is
tapped or another toast replaces it.

The service worker, install and `navigator.share` need a secure context, so
they are present on the HTTPS address and absent on the plain HTTP one. The
app reads `window.isSecureContext`: on an insecure page there is no worker
and so no Update ready, Share is hidden, and More says "Offline, install and
share need the HTTPS address." See [deployment](deployment.md).

## Identity

None. There are no accounts and nothing records who made a change. Reaching
the app is decided by the network it is on.
