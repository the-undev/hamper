import { liveQuery, type Table } from "dexie";
import { useSyncExternalStore } from "react";
import { type HamperDb, readCursor } from "@/store/db";
import {
  type SyncTable,
  syncTables,
  type TableRowLists,
  type TableRows,
} from "@/store/types";
import {
  type PushChange,
  type RevisionEvents,
  type SyncApi,
  SyncError,
  SyncUnreachableError,
} from "./api";

/** What the status bar shows about sync. */
export interface SyncStatus {
  /** The browser is online and the last push or pull reached the server. */
  online: boolean;
  /** The number of rows waiting in the outbox. */
  pending: number;
  lastSyncAt: string | null;
  /** The title of the last problem the server reported, cleared by a clean sync. */
  lastError: string | null;
}

/** The current sync status and a way to hear when it changes. */
export interface SyncStatusStore {
  /** Returns the current status; the object changes only when the status does. */
  get(): SyncStatus;
  /** Calls the listener on every change and returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** Drains the outbox and pulls changes, on demand and whenever the server or the browser says to. */
export interface SyncLoop {
  /** Opens the event stream and listens for the browser coming online or into focus. */
  start(): void;
  /** Closes the event stream and stops listening. */
  stop(): void;
  /** Pushes then pulls; a call while one runs queues one more run and shares its promise. */
  syncNow(): Promise<void>;
  status: SyncStatusStore;
}

/** What the loop needs from outside: the store, the server, the event stream, the clock and the browser's online flag. */
export interface SyncLoopDeps {
  db: HamperDb;
  api: SyncApi;
  events: () => RevisionEvents;
  now: () => string;
  online: () => boolean;
}

/** An outbox entry as it stood when its row went into a batch. */
interface SentEntry {
  seq: number;
  dirtiedAt: number;
}

/** Builds a sync loop over the given store and server. */
export function createSyncLoop({
  db,
  api,
  events,
  now,
  online,
}: SyncLoopDeps): SyncLoop {
  const syncedTables = syncTables.map((table) => db.table(table));
  let reachable = true;
  let status: SyncStatus = {
    online: online(),
    pending: 0,
    lastSyncAt: null,
    lastError: null,
  };
  const listeners = new Set<() => void>();
  let running: Promise<void> | null = null;
  let rerunQueued = false;
  let stopListening: (() => void) | null = null;

  const update = (changes: Partial<SyncStatus>): void => {
    status = { ...status, ...changes };
    for (const listener of listeners) {
      listener();
    }
  };
  const setReachable = (isReachable: boolean): void => {
    reachable = isReachable;
    update({ online: online() && reachable });
  };

  const tableOf = <T extends SyncTable>(
    table: T,
  ): Table<TableRows[T], string> => db.table(table);

  /** Upserts every row whose table and id are not waiting in the outbox; runs inside a transaction over the outbox. */
  const upsertClean = async (rows: TableRowLists): Promise<void> => {
    const dirtyKeys = new Set(
      (await db.outbox.toArray()).map(
        (entry) => `${entry.table}/${entry.rowId}`,
      ),
    );
    for (const table of syncTables) {
      const cleanRows = rows[table].filter(
        (row) => !dirtyKeys.has(`${table}/${row.id}`),
      );
      await tableOf(table).bulkPut(cleanRows);
    }
  };

  const buildBatch = (): Promise<{
    changes: PushChange[];
    sent: Map<string, SentEntry>;
  }> =>
    db.transaction("r", [...syncedTables, db.outbox], async () => {
      const changes: PushChange[] = [];
      const sent = new Map<string, SentEntry>();
      for (const entry of await db.outbox.orderBy("seq").toArray()) {
        const row = await tableOf(entry.table).get(entry.rowId);
        // Rows are only ever tombstoned, never removed, so every entry has its row.
        if (!row || entry.seq === undefined) {
          continue;
        }
        const { revision: _revision, ...wireRow } = row;
        const changeId = String(entry.seq);
        changes.push({ id: changeId, table: entry.table, row: wireRow });
        sent.set(changeId, { seq: entry.seq, dirtiedAt: entry.dirtiedAt });
      }
      return { changes, sent };
    });

  /** Sends the outbox; returns the server's problem title when it refused the batch. */
  const pushOutbox = async (): Promise<string | null> => {
    const { changes, sent } = await buildBatch();
    if (changes.length === 0) {
      return null;
    }
    let response: Awaited<ReturnType<SyncApi["push"]>>;
    try {
      response = await api.push(changes);
    } catch (error) {
      if (error instanceof SyncError) {
        return error.title;
      }
      throw error;
    }
    await db.transaction("rw", [...syncedTables, db.outbox], async () => {
      for (const changeId of response.applied) {
        const sentEntry = sent.get(changeId);
        if (!sentEntry) {
          continue;
        }
        const currentEntry = await db.outbox.get(sentEntry.seq);
        if (currentEntry?.dirtiedAt === sentEntry.dirtiedAt) {
          await db.outbox.delete(sentEntry.seq);
        }
      }
      await upsertClean(response.rows);
    });
    return null;
  };

  const pullChanges = async (): Promise<void> => {
    const response = await api.pull(await readCursor(db));
    await db.transaction(
      "rw",
      [...syncedTables, db.outbox, db.meta],
      async () => {
        await upsertClean(response);
        await db.meta.put({ key: "cursor", value: response.revision });
      },
    );
  };

  const syncOnce = async (): Promise<void> => {
    try {
      const pushProblem = await pushOutbox();
      await pullChanges();
      setReachable(true);
      update({ lastSyncAt: now(), lastError: pushProblem });
    } catch (error) {
      if (error instanceof SyncUnreachableError) {
        setReachable(false);
        return;
      }
      setReachable(true);
      update({
        lastError: error instanceof SyncError ? error.title : String(error),
      });
    }
  };

  const syncNow = (): Promise<void> => {
    if (running) {
      rerunQueued = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          rerunQueued = false;
          await syncOnce();
        } while (rerunQueued);
      } finally {
        running = null;
      }
    })();
    return running;
  };

  const start = (): void => {
    if (stopListening) {
      return;
    }
    const source = events();
    source.addEventListener("open", () => void syncNow());
    source.addEventListener("error", () => setReachable(false));
    source.addEventListener("revision", (event) => {
      const revision = Number(event.data);
      void readCursor(db).then((cursor) => {
        if (revision > cursor) {
          void syncNow();
        }
      });
    });

    const syncOnWake = (): void => void syncNow();
    const refreshOnline = (): void => update({ online: online() && reachable });
    const syncWhenVisible = (): void => {
      if (document.visibilityState === "visible") {
        void syncNow();
      }
    };
    window.addEventListener("online", syncOnWake);
    window.addEventListener("offline", refreshOnline);
    window.addEventListener("focus", syncOnWake);
    document.addEventListener("visibilitychange", syncWhenVisible);

    const pendingSubscription = liveQuery(() => db.outbox.count()).subscribe({
      next: (pending) => update({ pending }),
      error: (error: unknown) => update({ lastError: String(error) }),
    });

    stopListening = () => {
      source.close();
      window.removeEventListener("online", syncOnWake);
      window.removeEventListener("offline", refreshOnline);
      window.removeEventListener("focus", syncOnWake);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      pendingSubscription.unsubscribe();
    };
  };

  return {
    start,
    stop: () => {
      stopListening?.();
      stopListening = null;
    },
    syncNow,
    status: {
      get: () => status,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  };
}

/** Reads the loop's status and re-renders when it changes. */
export function useSyncStatus(loop: SyncLoop): SyncStatus {
  return useSyncExternalStore(loop.status.subscribe, loop.status.get);
}
