import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { useToast } from "@/components/Toast";

/** Whether a new service worker is waiting, and the way to switch to it. */
export interface AppUpdate {
  /** True once a new worker has installed and waits for the page to reload. */
  isReady(): boolean;
  /** Calls the listener when the update becomes ready and returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Activates the waiting worker and reloads the page. */
  reload(): Promise<void>;
}

/** Carries the app update from the app's start to the shell. */
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

/** Shows Update ready with a Reload action once, when a new version starts to wait. */
export function useUpdateToast(): void {
  const { ready, reload } = useAppUpdate();
  const showToast = useToast();
  useEffect(() => {
    if (!ready) {
      return;
    }
    showToast("Update ready", {
      label: "Reload",
      onAction: () => void reload(),
    });
  }, [ready, reload, showToast]);
}
