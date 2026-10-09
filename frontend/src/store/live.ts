import { useLiveQuery } from "dexie-react-hooks";
import type { SyncedRow } from "./types";

/** Runs a store query and re-renders whenever the rows it read change; undefined until the first result. */
export function useLive<T>(
  queryFn: () => Promise<T> | T,
  deps: unknown[],
): T | undefined {
  return useLiveQuery(queryFn, deps);
}

/** Leaves out tombstoned rows. */
export function liveRows<T extends SyncedRow>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.deletedAt === null);
}

/** Returns the row when it is live, else undefined. */
export function liveRow<T extends SyncedRow>(
  row: T | undefined,
): T | undefined {
  return row?.deletedAt === null ? row : undefined;
}
