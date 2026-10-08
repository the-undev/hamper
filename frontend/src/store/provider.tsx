import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from "react";
import type { SyncLoop } from "@/sync/loop";
import type { HamperDb } from "./db";

interface Store {
  db: HamperDb;
  loop: SyncLoop;
}

const StoreContext = createContext<Store | null>(null);

/** Provides the store and the sync loop to the app, running the loop while mounted. */
export function StoreProvider({
  db,
  loop,
  children,
}: {
  db: HamperDb;
  loop: SyncLoop;
  children: ReactNode;
}) {
  useEffect(() => {
    loop.start();
    return () => loop.stop();
  }, [loop]);
  const store = useMemo(() => ({ db, loop }), [db, loop]);
  return <StoreContext value={store}>{children}</StoreContext>;
}

function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useDb and useSyncLoop need a StoreProvider above them");
  }
  return store;
}

/** Reads the device store. */
export function useDb(): HamperDb {
  return useStore().db;
}

/** Reads the sync loop. */
export function useSyncLoop(): SyncLoop {
  return useStore().loop;
}
