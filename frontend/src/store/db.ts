import { Dexie, type Table } from "dexie";
import {
  type Item,
  type Meal,
  type MealLine,
  type Plan,
  type PlannedMeal,
  type PlannedMealLine,
  type Shop,
  type ShopLine,
  type SyncTable,
  syncTables,
  type WantedLine,
} from "./types";

/** A synced row changed on this device and not yet acknowledged by the server. */
export interface OutboxEntry {
  seq?: number;
  table: SyncTable;
  rowId: string;
  /** Moves on every change to the row, so a push can tell whether the row changed while it was in flight. */
  dirtiedAt: number;
}

/** A stored value by key; the sync cursor lives under `cursor`. */
export interface MetaEntry {
  key: string;
  value: number;
}

/** The device's store: every synced table, the outbox and the sync metadata. */
export class HamperDb extends Dexie {
  declare items: Table<Item, string>;
  declare meals: Table<Meal, string>;
  declare mealLines: Table<MealLine, string>;
  declare plan: Table<Plan, string>;
  declare plannedMeals: Table<PlannedMeal, string>;
  declare plannedMealLines: Table<PlannedMealLine, string>;
  declare wantedLines: Table<WantedLine, string>;
  declare shops: Table<Shop, string>;
  declare shopLines: Table<ShopLine, string>;
  declare outbox: Table<OutboxEntry, number>;
  declare meta: Table<MetaEntry, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      items: "id",
      meals: "id",
      mealLines: "id, mealId, itemId",
      plan: "id",
      days: "id, mealId",
      dayLines: "id, dayId, itemId",
      wantedLines: "id, itemId",
      shops: "id",
      shopLines: "id, shopId, itemId",
      outbox: "++seq, &[table+rowId]",
      meta: "key",
    });
    // Days became planned meals: every synced row, the outbox and the cursor go, so the next pull loads the new shape from 0.
    this.version(3)
      .stores({
        days: null,
        dayLines: null,
        plannedMeals: "id, position, mealId",
        plannedMealLines: "id, plannedMealId, itemId",
      })
      .upgrade(async (transaction) => {
        for (const table of [...syncTables, "outbox"]) {
          await transaction.table(table).clear();
        }
        await transaction.table("meta").delete("cursor");
      });
  }
}

/** Reads the sync cursor, 0 before the first pull. */
export async function readCursor(db: HamperDb): Promise<number> {
  const entry = await db.meta.get("cursor");
  return entry?.value ?? 0;
}

/** Finds the outbox entry for a row, if the row is dirty. */
export function outboxEntryFor(
  db: HamperDb,
  table: SyncTable,
  rowId: string,
): Promise<OutboxEntry | undefined> {
  return db.outbox.where("[table+rowId]").equals([table, rowId]).first();
}
