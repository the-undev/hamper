import { Dexie } from "dexie";
import { expect, test } from "vitest";
import { HamperDb } from "./db";
import { newId } from "./ids";

test("upgrade_gives_items_and_meals_stored_before_images_no_image", async () => {
  const name = `hamper-test-${newId()}`;
  const before = new Dexie(name);
  before.version(1).stores({ items: "id", meals: "id" });
  await before.table("items").put({
    id: "item-1",
    revision: 3,
    deletedAt: null,
    name: "Milk",
    size: null,
  });
  await before.table("meals").put({
    id: "meal-1",
    revision: 4,
    deletedAt: null,
    name: "Curry",
  });
  before.close();

  const db = new HamperDb(name);

  expect(await db.items.get("item-1")).toEqual({
    id: "item-1",
    revision: 3,
    deletedAt: null,
    name: "Milk",
    size: null,
    imageId: null,
  });
  expect((await db.meals.get("meal-1"))?.imageId).toBeNull();
  db.close();
});
