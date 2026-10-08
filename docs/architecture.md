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

## API

Every endpoint lives under `/api` except `/health`, the `/sync` endpoints and
`/images`, which the service worker treats differently from API calls. An
unknown path under `/api` or `/sync` is a problem+json 404; any other unknown
path gets the app shell.

- `GET /health`: the status for a monitor.
- `POST /api/shops/{id}/archive`: copies an open shop into history and
  tombstones it.
- `GET /api/history`: archived shops, newest first, with a line count.
- `GET /api/history/{id}`: one archived shop with its lines.
- `GET /api/export`: the export zip.
- `POST /api/import`: takes an export zip into an empty database.
- `GET /sync?since=<revision>`: every synced row written after the cursor,
  and the current revision. See [Pull](#pull).
- `POST /sync`: applies a batch of row changes and returns the rows as they
  now stand. See [Push](#push).
- `GET /sync/events`: a server-sent event stream of the current revision.
  See [Live updates](#live-updates).

The image endpoints are added in their phase of the
[build order](roadmap.md#build-order).

## Sync

Every device holds the whole synced dataset and a queue of changes not yet
sent. The server is the source of truth.

### Where the rules run

The rules in [domain](domain.md) run on the device against its store, so
every edit works offline. The server validates rows, assigns revisions, and
runs what needs history or the file system: archive, history, export, import
and images.

### What is synced

Items, meals and their lines, the plan with its days, planned meals and
wanted lines, and open shops with their lines. History and images are not.

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

The tables are `items`, `meals`, `mealLines`, `plan`, `days`, `dayLines`,
`wantedLines`, `shops` and `shopLines`, the database tables in camelCase. A
row is a JSON object holding every column in camelCase, `revision` and
`deletedAt` included; `deletedAt` is null on a live row. Dates are
`yyyy-MM-dd` and timestamps ISO 8601 with an offset. A shop's `meals` and a
shop line's `sources` are JSON arrays.

The plan row's id is fixed at `5e1f0a3c-9b2d-4c47-8a61-2f3d4b5c6a70`. A
day's id is `da7e0000-0000-4000-8000-` followed by its position as twelve
hex digits, so every device names the same day the same way.

### Pull

`GET /sync?since=<revision>` returns the server's current revision and every
row of every synced table with a revision above `since`, deleted rows
included. `since` defaults to 0, and a negative one is a 400 problem.

```json
{ "revision": 42, "items": [], "meals": [], "mealLines": [], "plan": [],
  "days": [], "dayLines": [], "wantedLines": [], "shops": [], "shopLines": [] }
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
- a name empty after trimming, or longer than its maximum (items and meals
  200, an item's size 100);
- a count below 1;
- a plan `lengthDays` outside 1 to 31, or a plan row with another id;
- a day whose id does not match its position, or a negative position;
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
on `id` and indexed on the foreign keys `mealId`, `dayId`, `shopId` and
`itemId`, plus `outbox` and `meta`. A row the server has not yet seen has
revision 0.

The outbox holds one entry per changed row: `seq` (its place in the queue),
`table`, `rowId` and `dirtiedAt`. Changing a row already in the outbox keeps
its place and moves `dirtiedAt`. `meta` holds the sync cursor under `cursor`.

Every edit runs as one Dexie transaction over every synced table and the
outbox, so a row and its outbox entry are written together or not at all.
The rules in [domain](domain.md) are operations inside such a transaction.
The server makes the plan row, so an operation on the plan refuses until the
first pull has brought it.

Screens read the store through Dexie live queries, so a screen re-renders
when the store changes, whether from the user or from a pull. TanStack Query
serves only the REST endpoints, such as history and export.

A sync loop pushes and then pulls, one run at a time. A request to sync
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
above the cursor, when the browser comes online, and when the app comes back
into focus or view.

Offline is `navigator.onLine` false, or the last push, pull or event stream
failing to reach the server. The loop's status holds that, the size of the
outbox, when the last sync finished and the last problem the server
reported, for the status bar to show.

## Images

An item or meal has at most one image. The client opens the camera or the
photo picker, shows a crop box, and uploads the cropped image as JPEG.
`POST /api/items/{id}/image` and `POST /api/meals/{id}/image` take it; the
server resizes to two fixed sizes, a thumbnail for lists and a larger one for
the meal screen, and stores both under `/data/images/<id>/`. The database
holds the image's id and sizes. `GET /images/<id>/<size>` serves them with
long cache headers, and the service worker caches responses it has seen.

## Export and import

`GET /api/export` returns a zip named `hamper-<yyyyMMdd-HHmmss>.zip` holding
`data.json`: format 1, the plan's start date and length, every live row of
the synced tables without revisions, and all of history. Each row carries
`deletedAt`, null for a live row. A deleted item or meal that an exported row
still points at is exported as a tombstone, so every reference resolves on
import, where it stays deleted. Images join the zip in their phase of the
[build order](roadmap.md#build-order).

`POST /api/import` takes the same zip as the raw request body
(`application/zip`) and writes it in one transaction: every row as it
comes, `deletedAt` included, with new revisions, and the plan's start date and
length. It refuses with 409 when any item, meal, day, wanted line, shop or
archived shop exists, deleted ones included, and with 400 when the zip has no
`data.json`, the format is not 1, or the JSON does not fit the schema.

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
