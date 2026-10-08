import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "./routeTree.gen";
import { HamperDb } from "./store/db";
import { StoreProvider } from "./store/provider";
import { openEvents, syncApi } from "./sync/api";
import { createSyncLoop } from "./sync/loop";
import "./index.css";

const queryClient = new QueryClient();

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const db = new HamperDb("hamper");

const syncLoop = createSyncLoop({
  db,
  api: syncApi,
  events: openEvents,
  now: () => new Date().toISOString(),
  online: () => navigator.onLine,
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <StoreProvider db={db} loop={syncLoop}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StoreProvider>
  </StrictMode>,
);
