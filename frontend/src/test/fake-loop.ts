import { vi } from "vitest";
import type { SyncLoop, SyncStatus } from "@/sync/loop";

/** The status of a loop that is online with nothing to send. */
export const quietStatus: SyncStatus = {
  online: true,
  syncing: false,
  pending: 0,
  lastSyncAt: null,
  lastError: null,
};

/** A sync loop that never talks to a server; a test sets its status and sees the subscribers told. */
export interface FakeLoop extends SyncLoop {
  setStatus(status: SyncStatus): void;
}

/** Builds a loop with spied start, stop and syncNow over a status the test controls. */
export function fakeLoop(initialStatus: SyncStatus = quietStatus): FakeLoop {
  let status = initialStatus;
  const listeners = new Set<() => void>();
  return {
    start: vi.fn(),
    stop: vi.fn(),
    syncNow: vi.fn(async () => {}),
    status: {
      get: () => status,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    setStatus: (nextStatus) => {
      status = nextStatus;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
