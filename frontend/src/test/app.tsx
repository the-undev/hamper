import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, createAppRouter } from "@/app";
import type { HamperDb } from "@/store/db";
import type { SyncLoop } from "@/sync/loop";
import { fakeAppUpdate } from "./fake-app-update";

/** Renders the whole app at a path over a real store, returning the router, a user to drive it and the app update to make ready. */
export function renderApp(path: string, db: HamperDb, loop: SyncLoop) {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const user = userEvent.setup();
  const appUpdate = fakeAppUpdate();
  render(
    <App
      db={db}
      loop={loop}
      appUpdate={appUpdate}
      queryClient={queryClient}
      router={router}
    />,
  );
  return { router, user, queryClient, appUpdate };
}
