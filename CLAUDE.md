# CLAUDE.md

hamper: a household's meal plan and shopping list, served from the home server
to phones. The code follows the docs, never the other way round.

## Read first

- [docs/principles.md](docs/principles.md) before proposing any feature. A
  feature that breaks one is not worth having.
- [docs/domain.md](docs/domain.md) before touching the model or the schema.
- [docs/architecture.md](docs/architecture.md) before writing code.
- [docs/roadmap.md](docs/roadmap.md) holds everything parked. Anything worth
  returning to goes there, in a commit, never in chat.

## Layout

- `backend/`: .NET 10 solution `Hamper.slnx`, with `src/Hamper.Api` (every
  feature) and `tests/Hamper.Api.Tests`.
- `frontend/`: Vite, React, TypeScript strict, Tailwind v4, TanStack Router
  and Query, pnpm.
- `docs/`: all documentation; [docs/README.md](docs/README.md) is the index.
  `docs/prototype.html` is a clickable sketch of the screens. It is replaced by
  the real frontend, never grown into it.

## Commands

| What | Command |
| --- | --- |
| Every gate | `make check` |
| Browser tests, before a merge; CI runs it too | `make e2e` |
| Run the API and Vite | `make dev` |
| Isolated API for live checks (own database and data dir) | `make live-test` |
| Build the production image | `make image` (optional `VERSION=x.y.z`) |
| Cut a release | Push a `v*` tag; the Release workflow runs the gates and publishes the image |
| Backend build and test | `cd backend && dotnet build && dotnet test` |
| Backend format check | `cd backend && dotnet format Hamper.slnx --verify-no-changes` |
| Add an EF migration | `cd backend && dotnet ef migrations add <Name> --project src/Hamper.Api -o Infrastructure/Persistence/Migrations` |
| Frontend gates | `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` |

### Ports

| What | Port |
| --- | --- |
| API, dev | 8776 |
| Vite dev server, proxies `/api`, `/sync` and `/images` to 8776 | 5276 |
| Vite preview | 4276 |
| API, live test | 8777 |
| API, browser tests | 8778 |
| Container | 8080 |

Never use skarrow's ports (8766, 8767, 8768, 5273, 4273) or the legacy app's
(8765, 5173). Both run on the same machine.

## Never touch the dev database

`backend/src/Hamper.Api/hamper.db` and `hamper-data/` belong to the developer.
Never delete them, never reset them, and treat anything listening on 8776 as
the developer's own session. Every live check goes through `make live-test`,
which runs the API on 8777 with its own database and data directory.

## Hard conventions

[docs/architecture.md](docs/architecture.md) is the authority. The headlines:

- Vertical slices: one folder per feature under `Features/`, one file per
  operation. `Infrastructure/` is cross-cutting plumbing only.
- Every behaviour change ships with a test in the same commit, an integration
  test through `HamperApiFactory` by default. Never mock the database.
- A behaviour the jsdom suite cannot see (gestures, timing, the worker, the
  network) ships with a Playwright test under `frontend/e2e/` instead.
- Dependencies are required parameters, never optional with a null guard.
- No infrastructure without a consumer.
- API errors are always problem+json.
- File IO only through the storage seam (`IFileStorage`), time only through
  `TimeProvider`. Both are enforced by the analyzer through
  `BannedSymbols.txt`.
- Warnings are errors. Fix the cause; a suppression carries a one-line
  comment saying why.

## Workflow

- Plan before code. The plan is approved in text before any file changes.
- Small commits on a branch. `main` moves only when told.
- Every behaviour change ships with its test in the same commit.
- Verify before claiming done, and report actual command output.
- A change to how the model works updates `docs/domain.md` in the same commit.
  A change to how it is built or run updates `docs/deployment.md`.

## Writing

British English. Plain declarative sentences, one idea each. State a fact once.
No em dashes. No "X is not Y, it is Z". No marketing adjectives. Docs say how
things are now; what was rejected and why lives in commit bodies and the
roadmap. Unknown is `TBD`, never a guess.
