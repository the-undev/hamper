import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, createAppRouter } from "@/app";
import type { HamperDb } from "@/store/db";
import type { SyncLoop } from "@/sync/loop";

/** Renders the whole app at a path over a real store, returning the router and a user to drive it. */
export function renderApp(path: string, db: HamperDb, loop: SyncLoop) {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const user = userEvent.setup();
  render(<App db={db} loop={loop} queryClient={queryClient} router={router} />);
  return { router, user, queryClient };
}
