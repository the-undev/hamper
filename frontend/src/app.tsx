import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRouter,
  type RouterHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { ToastProvider } from "./components/Toast";
import { routeTree } from "./routeTree.gen";
import type { HamperDb } from "./store/db";
import { StoreProvider } from "./store/provider";
import type { SyncLoop } from "./sync/loop";

/** Builds the router over the given history: the browser's in the app, a memory one in tests. */
export function createAppRouter(history: RouterHistory) {
  return createRouter({ routeTree, history });
}

/** The router the app runs. */
export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

/** The app with its store, sync loop, REST cache and router. */
export function App({
  db,
  loop,
  queryClient,
  router,
}: {
  db: HamperDb;
  loop: SyncLoop;
  queryClient: QueryClient;
  router: AppRouter;
}) {
  return (
    <StoreProvider db={db} loop={loop}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </StoreProvider>
  );
}
