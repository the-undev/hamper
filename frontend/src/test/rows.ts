import type { HamperDb } from "@/store/db";
import { dayIdFor, newId, planId } from "@/store/ids";
import { liveRows } from "@/store/live";
import {
  type Day,
  type DayLine,
  type Item,
  type Meal,
  type MealLine,
  type Plan,
  type Shop,
  type ShopLine,
  type SyncTable,
  syncTables,
  type TableRowLists,
  type TableRows,
  type WantedLine,
} from "@/store/types";

/** The clock reading tests pass to operations. */
export const now = "2026-06-01T09:00:00.000Z";

const synced = () => ({ id: newId(), revision: 0, deletedAt: null });

/** An item row. */
export function anItem(name: string, size: string | null = null): Item {
  return { ...synced(), name, size, imageId: null };
}

/** A meal row. */
export function aMeal(name: string): Meal {
  return { ...synced(), name, imageId: null };
}

/** A meal line row. */
export function aMealLine(meal: Meal, item: Item, count: number): MealLine {
  return { ...synced(), mealId: meal.id, itemId: item.id, count };
}

/** The plan row. */
export function thePlan(startDate = "2026-06-01", lengthDays = 7): Plan {
  return { id: planId, revision: 1, deletedAt: null, startDate, lengthDays };
}

/** A day row at a position. */
export function aDay(
  position: number,
  name: string,
  meal: Meal | null = null,
): Day {
  return {
    ...synced(),
    id: dayIdFor(position),
    position,
    name,
    mealId: meal?.id ?? null,
  };
}

/** A day line row. */
export function aDayLine(day: Day, item: Item, count: number): DayLine {
  return { ...synced(), dayId: day.id, itemId: item.id, count };
}

/** A wanted line row. */
export function aWantedLine(
  item: Item,
  count: number,
  weekly = false,
): WantedLine {
  return { ...synced(), itemId: item.id, count, weekly };
}

/** An open shop row started empty. */
export function aShop(name: string): Shop {
  return {
    ...synced(),
    name,
    createdAt: now,
    fromPlan: false,
    planStartDate: null,
    planLengthDays: null,
    meals: [],
  };
}

/** A shop line row. */
export function aShopLine(shop: Shop, item: Item, count: number): ShopLine {
  return {
    ...synced(),
    shopId: shop.id,
    itemId: item.id,
    count,
    nameOverride: null,
    sizeOverride: null,
    sources: [],
    ticked: false,
    createdAt: now,
  };
}

/** Stores rows straight into the tables, leaving the outbox empty. */
export async function seed(
  db: HamperDb,
  rows: Partial<TableRowLists>,
): Promise<void> {
  await db.transaction(
    "rw",
    syncTables.map((table) => db.table(table)),
    async () => {
      for (const table of syncTables) {
        await db.table(table).bulkPut(rows[table] ?? []);
      }
    },
  );
}

/** Reads the live rows of a table. */
export async function live<T extends SyncTable>(
  db: HamperDb,
  table: T,
): Promise<TableRows[T][]> {
  return liveRows(await db.table<TableRows[T], string>(table).toArray());
}
