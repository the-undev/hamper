import { Dexie } from "dexie";
import { expect, test } from "vitest";
import { HamperDb, readCursor } from "./db";
import { newId } from "./ids";
import { syncTables } from "./types";

test("upgrade_to_planned_meals_clears_the_synced_stores_the_outbox_and_the_cursor", async () => {
  const name = `hamper-test-${newId()}`;
  const before = new Dexie(name);
  before.version(2).stores({
    items: "id",
    meals: "id",
    days: "id, mealId",
    dayLines: "id, dayId, itemId",
    outbox: "++seq, &[table+rowId]",
    meta: "key",
  });
  await before.table("items").put({
    id: "item-1",
    revision: 3,
    deletedAt: null,
    name: "Milk",
    size: null,
  });
  await before.table("days").put({
    id: "da7e0000-0000-4000-8000-000000000000",
    revision: 4,
    deletedAt: null,
    position: 0,
    name: "Curry",
    mealId: null,
  });
  await before
    .table("outbox")
    .add({ table: "items", rowId: "item-1", dirtiedAt: 1 });
  await before.table("meta").put({ key: "cursor", value: 4 });
  before.close();

  const db = new HamperDb(name);

  for (const table of syncTables) {
    expect(await db.table(table).count()).toBe(0);
  }
  expect(await db.outbox.count()).toBe(0);
  expect(await readCursor(db)).toBe(0);
  expect(db.tables.map((table) => table.name)).not.toContain("days");
  expect(
    db.plannedMeals.schema.indexes.map((index) => index.name).sort(),
  ).toEqual(["mealId", "position"]);
  db.close();
  await db.delete();
});
