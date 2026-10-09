import { registerSW } from "virtual:pwa-register";
import type { AppUpdate } from "./update";

/** Registers the service worker; the update turns ready when a new worker waits, and never where there is no service worker. */
export function registerServiceWorker(): AppUpdate {
  let ready = false;
  const listeners = new Set<() => void>();
  const updateServiceWorker = registerSW({
    onNeedRefresh: () => {
      ready = true;
      for (const listener of listeners) {
        listener();
      }
    },
  });
  return {
    isReady: () => ready,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reload: () => updateServiceWorker(true),
  };
}
