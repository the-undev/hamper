import type { Table } from "dexie";
import { type HamperDb, outboxEntryFor } from "./db";
import { type SyncTable, syncTables, type TableRows } from "./types";

/** The foreign keys the store indexes. */
type ForeignKey = "mealId" | "dayId" | "shopId" | "itemId";

/** The indexed foreign keys a table's rows carry. */
export type IndexedKey<T extends SyncTable> = Extract<
  keyof TableRows[T],
  ForeignKey
>;

/** Reads and writes inside one store transaction; every put also marks the row dirty in the outbox. */
export interface Writer {
  /** Reads one row by id, tombstoned or not. */
  get<T extends SyncTable>(
    table: T,
    id: string,
  ): Promise<TableRows[T] | undefined>;
  /** Reads every row whose foreign key holds the value, tombstones included. */
  where<T extends SyncTable>(
    table: T,
    key: IndexedKey<T>,
    value: string,
  ): Promise<TableRows[T][]>;
  /** Reads every row of a table, tombstones included. */
  all<T extends SyncTable>(table: T): Promise<TableRows[T][]>;
  /** Upserts the row and records it in the outbox once, keeping its first place. */
  put<T extends SyncTable>(table: T, row: TableRows[T]): Promise<void>;
  /** Sets the row's deletedAt through put; a row already tombstoned is left alone. */
  tombstone<T extends SyncTable>(
    table: T,
    id: string,
    now: string,
  ): Promise<void>;
}

/** Runs fn in one read-write transaction over every table and the outbox, so a change and its outbox entry commit together. */
export function write<R>(
  db: HamperDb,
  fn: (w: Writer) => Promise<R>,
): Promise<R> {
  const tables = [...syncTables.map((table) => db.table(table)), db.outbox];
  // Dexie follows native awaits through the transaction only when the scope function is itself async.
  return db.transaction("rw", tables, async () => await fn(createWriter(db)));
}

function createWriter(db: HamperDb): Writer {
  const tableOf = <T extends SyncTable>(
    table: T,
  ): Table<TableRows[T], string> => db.table(table);

  const markDirty = async (table: SyncTable, rowId: string): Promise<void> => {
    const entry = await outboxEntryFor(db, table, rowId);
    if (!entry?.seq) {
      await db.outbox.add({ table, rowId, dirtiedAt: Date.now() });
      return;
    }
    // Two changes in one millisecond must still move it, or a push in flight would miss the second.
    const dirtiedAt = Math.max(Date.now(), entry.dirtiedAt + 1);
    await db.outbox.update(entry.seq, { dirtiedAt });
  };

  const put = async <T extends SyncTable>(
    table: T,
    row: TableRows[T],
  ): Promise<void> => {
    await tableOf(table).put(row);
    await markDirty(table, row.id);
  };

  return {
    get: (table, id) => tableOf(table).get(id),
    where: (table, key, value) =>
      tableOf(table).where(key).equals(value).toArray(),
    all: (table) => tableOf(table).toArray(),
    put,
    tombstone: async (table, id, now) => {
      const row = await tableOf(table).get(id);
      if (!row) {
        throw new Error(`No ${table} row ${id} to delete`);
      }
      if (row.deletedAt !== null) {
        return;
      }
      await put(table, { ...row, deletedAt: now });
    },
  };
}
