import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { write } from "@/store/write";
import { freshDb } from "@/test/db";
import {
  aDay,
  aDayLine,
  aMeal,
  aMealLine,
  anItem,
  aShop,
  aShopLine,
  aWantedLine,
  live,
  now,
  seed,
} from "@/test/rows";
import { DomainError } from "./checks";
import { lineName } from "./display";
import {
  deleteItem,
  ensureItem,
  mergeItem,
  renameItem,
  setItemSize,
} from "./items";

let db: HamperDb;

beforeEach(() => {
  db = freshDb();
});

afterEach(async () => {
  await db.delete();
});

test("an_item_comes_into_being_by_typing_a_name", async () => {
  const { item: milk, created } = await write(db, (w) =>
    ensureItem(w, "  Milk "),
  );

  expect(created).toBe(true);
  expect(await live(db, "items")).toEqual([milk]);
  expect(milk.name).toBe("Milk");
  expect(await db.outbox.toArray()).toMatchObject([
    { table: "items", rowId: milk.id },
  ]);
});

test("typing_a_name_already_used_finds_that_item_ignoring_case_and_spaces", async () => {
  const milk = anItem("Milk");
  await seed(db, { items: [milk] });

  const { item: foundItem, created } = await write(db, (w) =>
    ensureItem(w, " milk"),
  );

  expect(foundItem.id).toBe(milk.id);
  expect(created).toBe(false);
  expect(await db.items.count()).toBe(1);
});

test("typing_the_name_of_a_deleted_item_makes_a_new_item", async () => {
  const deletedMilk = { ...anItem("Milk"), deletedAt: now };
  await seed(db, { items: [deletedMilk] });

  const { item: milk } = await write(db, (w) => ensureItem(w, "Milk"));

  expect(milk.id).not.toBe(deletedMilk.id);
});

test("an_item_needs_a_name", async () => {
  await expect(write(db, (w) => ensureItem(w, "   "))).rejects.toThrow(
    DomainError,
  );
});

test("renaming_an_item_changes_it_everywhere_it_is_referenced", async () => {
  const milk = anItem("Milk");
  const shop = aShop("Big shop");
  const shopLine = aShopLine(shop, milk, 1);
  await seed(db, { items: [milk], shops: [shop], shopLines: [shopLine] });

  await write(db, (w) => renameItem(w, milk.id, "Semi-skimmed milk"));

  const renamedItem = await db.items.get(milk.id);
  expect(renamedItem?.name).toBe("Semi-skimmed milk");
  expect(renamedItem && lineName(shopLine, renamedItem)).toBe(
    "Semi-skimmed milk",
  );
});

test("an_items_usual_size_is_set_once_and_cleared_when_empty", async () => {
  const milk = anItem("Milk");
  await seed(db, { items: [milk] });

  await write(db, (w) => setItemSize(w, milk.id, " 4 pints "));
  expect((await db.items.get(milk.id))?.size).toBe("4 pints");

  await write(db, (w) => setItemSize(w, milk.id, " "));
  expect((await db.items.get(milk.id))?.size).toBeNull();
});

test("merging_repoints_every_reference_at_the_target_and_removes_the_source", async () => {
  const milk = anItem("Milk");
  const semiSkimmed = anItem("Semi-skimmed");
  const curry = aMeal("Curry");
  const monday = aDay(0, "Curry", curry);
  const shop = aShop("Big shop");
  await seed(db, {
    items: [milk, semiSkimmed],
    meals: [curry],
    mealLines: [aMealLine(curry, milk, 1)],
    days: [monday],
    dayLines: [aDayLine(monday, milk, 2)],
    wantedLines: [aWantedLine(milk, 3)],
    shops: [shop],
    shopLines: [aShopLine(shop, milk, 4)],
  });

  await write(db, (w) => mergeItem(w, milk.id, semiSkimmed.id, now));

  expect((await db.items.get(milk.id))?.deletedAt).toBe(now);
  for (const table of [
    "mealLines",
    "dayLines",
    "wantedLines",
    "shopLines",
  ] as const) {
    const lines = await live(db, table);
    expect(lines.map((line) => [line.itemId, line.count])).toEqual([
      [semiSkimmed.id, expect.any(Number)],
    ]);
  }
});

test("merging_combines_lines_that_become_duplicates_on_one_meal_or_day_by_adding_counts", async () => {
  const milk = anItem("Milk");
  const semiSkimmed = anItem("Semi-skimmed");
  const curry = aMeal("Curry");
  const monday = aDay(0, "Curry", curry);
  await seed(db, {
    items: [milk, semiSkimmed],
    meals: [curry],
    mealLines: [aMealLine(curry, milk, 2), aMealLine(curry, semiSkimmed, 1)],
    days: [monday],
    dayLines: [aDayLine(monday, milk, 1), aDayLine(monday, semiSkimmed, 4)],
  });

  await write(db, (w) => mergeItem(w, milk.id, semiSkimmed.id, now));

  expect(
    (await live(db, "mealLines")).map((line) => [line.itemId, line.count]),
  ).toEqual([[semiSkimmed.id, 3]]);
  expect(
    (await live(db, "dayLines")).map((line) => [line.itemId, line.count]),
  ).toEqual([[semiSkimmed.id, 5]]);
});

test("merging_combines_duplicate_extras_lines_and_keeps_the_targets_mark", async () => {
  const milk = anItem("Milk");
  const semiSkimmed = anItem("Semi-skimmed");
  await seed(db, {
    items: [milk, semiSkimmed],
    wantedLines: [aWantedLine(milk, 2), aWantedLine(semiSkimmed, 1, true)],
  });

  await write(db, (w) => mergeItem(w, milk.id, semiSkimmed.id, now));

  expect(await live(db, "wantedLines")).toMatchObject([
    { itemId: semiSkimmed.id, count: 3, weekly: true },
  ]);
});

test("merging_repoints_open_shop_lines_without_combining_them", async () => {
  const milk = anItem("Milk");
  const semiSkimmed = anItem("Semi-skimmed");
  const shop = aShop("Big shop");
  await seed(db, {
    items: [milk, semiSkimmed],
    shops: [shop],
    shopLines: [aShopLine(shop, milk, 1), aShopLine(shop, semiSkimmed, 2)],
  });

  await write(db, (w) => mergeItem(w, milk.id, semiSkimmed.id, now));

  const shopLines = await live(db, "shopLines");
  expect(shopLines.map((line) => line.itemId)).toEqual([
    semiSkimmed.id,
    semiSkimmed.id,
  ]);
});

test("deleting_an_item_removes_its_lines_from_meals_and_the_plan", async () => {
  const milk = anItem("Milk");
  const rice = anItem("Rice");
  const curry = aMeal("Curry");
  const monday = aDay(0, "Curry", curry);
  await seed(db, {
    items: [milk, rice],
    meals: [curry],
    mealLines: [aMealLine(curry, milk, 1), aMealLine(curry, rice, 1)],
    days: [monday],
    dayLines: [aDayLine(monday, milk, 1)],
    wantedLines: [aWantedLine(milk, 1)],
  });

  await write(db, (w) => deleteItem(w, milk.id, now));

  expect((await db.items.get(milk.id))?.deletedAt).toBe(now);
  expect((await live(db, "mealLines")).map((line) => line.itemId)).toEqual([
    rice.id,
  ]);
  expect(await live(db, "dayLines")).toEqual([]);
  expect(await live(db, "wantedLines")).toEqual([]);
});

test("deleting_an_item_leaves_its_lines_on_open_shops_showing_the_name_it_last_had", async () => {
  const milk = anItem("Milk");
  const shop = aShop("Big shop");
  const shopLine = aShopLine(shop, milk, 1);
  await seed(db, { items: [milk], shops: [shop], shopLines: [shopLine] });

  await write(db, (w) => deleteItem(w, milk.id, now));

  expect(await live(db, "shopLines")).toEqual([shopLine]);
  const deletedItem = await db.items.get(milk.id);
  expect(deletedItem && lineName(shopLine, deletedItem)).toBe("Milk");
});
