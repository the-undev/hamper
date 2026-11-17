# CLAUDE.md

hamper: a household's meal plan and shopping list, served from the home server
to phones.

## Read first

- [docs/principles.md](docs/principles.md) before proposing any feature. A
  feature that breaks one is not worth having.
- [docs/domain.md](docs/domain.md) before touching the model or the schema.
- [docs/architecture.md](docs/architecture.md) before writing code.
- [docs/roadmap.md](docs/roadmap.md) holds everything parked.

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
| Full check, every gate | `make check` |
| Build the backend and the frontend | `make` |
| Dev instance: the API and Vite, on the developer's own database `backend/src/Hamper.Api/hamper.db` and data directory `backend/src/Hamper.Api/hamper-data/` | `make dev` |
| Isolated run: the API in Release serving a fresh frontend build on 8777, with its own database and data directory under `/tmp/hamper-live-test`; open `http://127.0.0.1:8777` | `make live-test` |
| Browser tests, before a merge; CI runs it too | `make e2e` |
| Build the production image | `make image` (optional `VERSION=x.y.z`) |
| Run the image as uid 99 and as root and check it; CI runs it too | `make image-check` |
| Publish an edge image | Push to main, or run the Publish edge workflow on a branch |
| Cut a release | Push a `v*` tag; the Release workflow runs the gates and publishes the image |
| Backend build and test | `cd backend && dotnet build && dotnet test` |
| Backend format check | `cd backend && dotnet format Hamper.slnx --verify-no-changes` |
| Check no migration is missing (after a build) | `make backend-migrations` |
| Add an EF migration | `cd backend && dotnet ef migrations add <Name> --project src/Hamper.Api -o Infrastructure/Persistence/Migrations` |
| Frontend gates | `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` |

## Ports

| What | Port |
| --- | --- |
| API, dev | 8776 |
| Vite dev server, proxies `/api`, `/sync` and `/images` to 8776 | 5276 |
| Vite preview | 4276 |
| API, live test | 8777 |
| API, browser tests | 8778 |
| Container | 8080 |

## Conventions

[docs/architecture.md](docs/architecture.md) is the authority. The headlines:

- Vertical slices: one folder per feature under `Features/`, one file per
  operation. `Infrastructure/` is cross-cutting plumbing only.
- Integration tests go through `HamperApiFactory`.
- A behaviour the jsdom suite cannot see (gestures, timing, the worker, the
  network) ships with a Playwright test under `frontend/e2e/` instead.
- API errors are always problem+json.
- File IO only through the storage seam (`IFileStorage`), time only through
  `TimeProvider`. Both are enforced by the analyzer through
  `BannedSymbols.txt`.

## Workflow

- Changes go into main by merging the ticket branch locally, then pushing
  main.
- A change to how the model works updates `docs/domain.md` in the same commit.
  A change to how it is built or run updates `docs/deployment.md`.
