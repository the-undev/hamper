import { createContext, useContext, useSyncExternalStore } from "react";

/** Whether a new service worker is waiting, and the way to switch to it. */
export interface AppUpdate {
  /** True once a new worker has installed and waits for the page to reload. */
  isReady(): boolean;
  /** Calls the listener when the update becomes ready and returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Activates the waiting worker and reloads the page. */
  reload(): Promise<void>;
}

/** Carries the app update from the app's start to the status bar. */
export const AppUpdateContext = createContext<AppUpdate | null>(null);

/** Reads the app update and re-renders when it becomes ready. */
export function useAppUpdate(): {
  ready: boolean;
  reload: () => Promise<void>;
} {
  const update = useContext(AppUpdateContext);
  if (!update) {
    throw new Error("useAppUpdate needs an AppUpdateContext above it");
  }
  const ready = useSyncExternalStore(update.subscribe, update.isReady);
  return { ready, reload: update.reload };
}
