# CLAUDE.md

hamper: a household's meal plan and shopping list, served from the home server
to phones. Specification only so far; the code follows the docs, never the other
way round.

## Read first

- [docs/principles.md](docs/principles.md) before proposing any feature. A
  feature that breaks one is not worth having.
- [docs/domain.md](docs/domain.md) before touching the model or the schema.
- [docs/architecture.md](docs/architecture.md) before writing code.
- [docs/roadmap.md](docs/roadmap.md) holds everything parked. Anything worth
  returning to goes there, in a commit, never in chat.

## Layout

- `docs/` is all documentation; [docs/README.md](docs/README.md) is the index.
- `docs/prototype.html` is a clickable sketch of the screens. It is for seeing
  the flow, and it is replaced by the real frontend, never grown into it.
- `backend/` and `frontend/` arrive with the first code, in the shape set out
  in [docs/architecture.md](docs/architecture.md).

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
