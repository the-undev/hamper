import { QueryClient } from "@tanstack/react-query";
import { createBrowserHistory } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, createAppRouter } from "./app";
import { registerServiceWorker } from "./pwa/register";
import { HamperDb } from "./store/db";
import { openEvents, syncApi } from "./sync/api";
import { createSyncLoop } from "./sync/loop";
import "./index.css";

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
    <App
      db={db}
      loop={syncLoop}
      appUpdate={registerServiceWorker()}
      queryClient={new QueryClient()}
      router={createAppRouter(createBrowserHistory())}
    />
  </StrictMode>,
);
