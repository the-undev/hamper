# hamper

What the household eats this week, and what to buy for it. A plan of meals
against days, plus the other things wanted, becomes a shopping list that is
edited against what is already in the kitchen and ticked off in the shop, on a
phone, with or without signal.

It does not manage recipes. A meal is a name, a picture and the things to buy
for it.

## Status

The API, the frontend, sync, images, the PWA and the release image are built.
It needs the .NET 10 SDK, Node 24 and pnpm. `make setup` installs the
dependencies, `make dev` runs the API and Vite, and `make check` runs every
gate. A pushed `v*` tag publishes the image to `ghcr.io/the-undev/hamper`;
[docs/deployment.md](docs/deployment.md) says how to run it.
[docs/prototype.html](docs/prototype.html) is a clickable sketch of the screens
on sample data.

- [docs/principles.md](docs/principles.md): rules the design obeys, each taken
  from something that went wrong with what came before.
- [docs/domain.md](docs/domain.md): the things it represents and the rules
  between them.
- [docs/needs.md](docs/needs.md): what it has to do, by flow.
- [docs/screens.md](docs/screens.md): the four screens and the paths through
  them.
- [docs/architecture.md](docs/architecture.md): the stack, sync, images, export.
- [docs/deployment.md](docs/deployment.md): the image, the release workflow,
  running the container, what the host provides.
- [docs/roadmap.md](docs/roadmap.md): what is parked, and the decisions still
  open.

## Stack

- Backend: C# / .NET 10, ASP.NET Core minimal APIs, EF Core + SQLite,
  Magick.NET for resizing images.
- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn, TanStack
  Router and Query, dnd-kit, Dexie for the on-device store. Installable as a
  PWA through `vite-plugin-pwa`.
- One container: the API serves the built frontend. One `/data` volume holds
  the database and the images.

The shape is taken from [skarrow](https://github.com/skarrow-app/skarrow),
minus Aspire, plus the PWA and sync pieces.

## Licence

MIT, see [LICENSE](LICENSE).
