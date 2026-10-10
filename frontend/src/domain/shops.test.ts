import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { planId } from "@/store/ids";
import { write } from "@/store/write";
import { freshDb } from "@/test/db";
import {
  aMeal,
  anItem,
  aPlannedMeal,
  aPlannedMealLine,
  aShop,
  aShopLine,
  aWantedLine,
  live,
  now,
  seed,
  thePlan,
} from "@/test/rows";
import {
  addShopLine,
  deleteShop,
  editShopLine,
  generateShop,
  lineToWanted,
  removeShopLine,
  restToWanted,
  shopText,
  startEmptyShop,
  tickShopLine,
} from "./shops";

let db: HamperDb;

const rice = anItem("Rice", "1kg bag");
const naan = anItem("Naan");
const milk = anItem("Milk", "4 pints");
const curry = aMeal("Curry");
const monday = aPlannedMeal(0, "Curry", curry);
const tuesday = aPlannedMeal(1, "Fajitas");
const sunday = aPlannedMeal(6, "Roast");
const nextMonday = aPlannedMeal(7, "Beyond the plan");

beforeEach(() => {
  db = freshDb();
});

afterEach(async () => {
  await db.delete();
});

/** Seeds the plan with planned meals on days 0, 1, 6 and 7, of which 7 is beyond the length. */
async function seedPlan(): Promise<void> {
  await seed(db, {
    items: [rice, naan, milk],
    meals: [curry],
    plan: [thePlan("2026-06-01", 7)],
    plannedMeals: [monday, tuesday, sunday, nextMonday],
    plannedMealLines: [
      aPlannedMealLine(monday, rice, 1),
      aPlannedMealLine(monday, naan, 2),
      aPlannedMealLine(tuesday, rice, 2),
      aPlannedMealLine(sunday, rice, 1),
      aPlannedMealLine(nextMonday, rice, 9),
      { ...aPlannedMealLine(tuesday, naan, 5), deletedAt: now },
    ],
    wantedLines: [aWantedLine(rice, 1), aWantedLine(milk, 2, true)],
  });
}

async function shopLinesByItem(shopId: string) {
  const shopLines = (await live(db, "shopLines")).filter(
    (line) => line.shopId === shopId,
  );
  return new Map(shopLines.map((line) => [line.itemId, line]));
}

test("generating_sums_counts_per_item_across_the_planned_meals_and_the_extras_list", async () => {
  await seedPlan();

  const shop = await write(db, (w) => generateShop(w, "Big shop", now));

  const linesByItem = await shopLinesByItem(shop.id);
  expect(linesByItem.size).toBe(3);
  expect(linesByItem.get(rice.id)?.count).toBe(5);
  expect(linesByItem.get(naan.id)?.count).toBe(2);
  expect(linesByItem.get(milk.id)?.count).toBe(2);
});

test("generating_names_the_sources_in_position_order_with_extras_last", async () => {
  await seedPlan();

  const shop = await write(db, (w) => generateShop(w, "Big shop", now));

  const linesByItem = await shopLinesByItem(shop.id);
  expect(linesByItem.get(rice.id)?.sources).toEqual([
    "Curry",
    "Fajitas",
    "Roast",
    "extras",
  ]);
  expect(linesByItem.get(milk.id)?.sources).toEqual(["extras"]);
});

test("generating_ignores_days_at_or_beyond_the_length", async () => {
  await seedPlan();

  const shop = await write(db, (w) => generateShop(w, "Big shop", now));

  expect((await shopLinesByItem(shop.id)).get(rice.id)?.sources).not.toContain(
    "Beyond the plan",
  );
  expect(shop.meals.map((meal) => meal.position)).toEqual([0, 1, 6]);
});

test("generating_ignores_tombstoned_lines", async () => {
  await seedPlan();

  const shop = await write(db, (w) => generateShop(w, "Big shop", now));

  expect((await shopLinesByItem(shop.id)).get(naan.id)).toMatchObject({
    count: 2,
    sources: ["Curry"],
  });
});

test("generating_copies_the_plan_fields_and_the_meals_and_changes_nothing_on_the_plan", async () => {
  await seedPlan();
  const plannedMealsBefore = await live(db, "plannedMeals");
  const wantedBefore = await live(db, "wantedLines");

  const shop = await write(db, (w) => generateShop(w, "Big shop", now));

  expect(shop).toMatchObject({
    name: "Big shop",
    createdAt: now,
    fromPlan: true,
    planStartDate: "2026-06-01",
    planLengthDays: 7,
    meals: [
      { position: 0, rank: 0, name: "Curry", mealId: curry.id },
      { position: 1, rank: 0, name: "Fajitas", mealId: null },
      { position: 6, rank: 0, name: "Roast", mealId: null },
    ],
  });
  expect(await db.shops.get(shop.id)).toEqual(shop);
  expect(await live(db, "plannedMeals")).toEqual(plannedMealsBefore);
  expect(await live(db, "wantedLines")).toEqual(wantedBefore);
  expect((await db.plan.get(planId))?.startDate).toBe("2026-06-01");
});

test("one_meal_placed_on_two_days_is_counted_twice", async () => {
  const wednesday = aPlannedMeal(2, "Curry", curry);
  await seed(db, {
    items: [rice],
    meals: [curry],
    plan: [thePlan()],
    plannedMeals: [monday, wednesday],
    plannedMealLines: [
      aPlannedMealLine(monday, rice, 1),
      aPlannedMealLine(wednesday, rice, 1),
    ],
  });

  const shop = await write(db, (w) => generateShop(w, "Big shop", now));

  expect((await shopLinesByItem(shop.id)).get(rice.id)).toMatchObject({
    count: 2,
    sources: ["Curry", "Curry"],
  });
});

test("two_meals_on_one_day_both_count_in_the_shop", async () => {
  const lunch = aPlannedMeal(0, "Soup", null, 1);
  const supper = aPlannedMeal(0, "Rice pudding", null, 2);
  const tuesdayLunch = aPlannedMeal(1, "Risotto");
  await seed(db, {
    items: [rice],
    meals: [curry],
    plan: [thePlan()],
    // Seeded out of order, so the shop has to put them in plan order.
    plannedMeals: [tuesdayLunch, supper, monday, lunch],
    plannedMealLines: [
      aPlannedMealLine(supper, rice, 3),
      aPlannedMealLine(tuesdayLunch, rice, 4),
      aPlannedMealLine(monday, rice, 1),
      aPlannedMealLine(lunch, rice, 2),
    ],
  });

  const shop = await write(db, (w) => generateShop(w, "Big shop", now));

  expect((await shopLinesByItem(shop.id)).get(rice.id)).toMatchObject({
    count: 10,
    sources: ["Curry", "Soup", "Rice pudding", "Risotto"],
  });
  expect(shop.meals).toEqual([
    { position: 0, rank: 0, name: "Curry", mealId: curry.id },
    { position: 0, rank: 1, name: "Soup", mealId: null },
    { position: 0, rank: 2, name: "Rice pudding", mealId: null },
    { position: 1, rank: 0, name: "Risotto", mealId: null },
  ]);
});

test("a_shop_can_be_started_empty_for_a_quick_trip", async () => {
  const shop = await write(db, (w) => startEmptyShop(w, "Corner shop", now));

  expect(shop).toMatchObject({
    fromPlan: false,
    planStartDate: null,
    planLengthDays: null,
    meals: [],
  });
  expect(await live(db, "shopLines")).toEqual([]);
});

test("lines_are_added_by_typing_and_adding_an_item_already_there_raises_its_count", async () => {
  const shop = aShop("Corner shop");
  await seed(db, { items: [milk], shops: [shop] });

  await write(db, (w) => addShopLine(w, shop.id, milk.id, now));
  await write(db, (w) => addShopLine(w, shop.id, milk.id, now));

  expect(await live(db, "shopLines")).toMatchObject([
    { itemId: milk.id, count: 2, ticked: false, sources: [] },
  ]);
});

test("a_shop_lines_name_size_and_count_are_edited_on_the_shop_only", async () => {
  const shop = aShop("Corner shop");
  const line = aShopLine(shop, milk, 1);
  await seed(db, { items: [milk], shops: [shop], shopLines: [line] });

  await write(db, (w) =>
    editShopLine(w, line.id, {
      nameOverride: "Oat milk",
      sizeOverride: "1 litre",
      count: 3,
    }),
  );

  expect(await db.shopLines.get(line.id)).toMatchObject({
    nameOverride: "Oat milk",
    sizeOverride: "1 litre",
    count: 3,
  });
  expect(await db.items.get(milk.id)).toEqual(milk);
});

test("a_tick_says_whether_every_line_of_its_shop_is_ticked", async () => {
  const shop = aShop("Corner shop");
  const otherShop = aShop("Market");
  const milkLine = aShopLine(shop, milk, 1);
  const riceLine = aShopLine(shop, rice, 1);
  await seed(db, {
    items: [milk, rice],
    shops: [shop, otherShop],
    shopLines: [milkLine, riceLine, aShopLine(otherShop, milk, 1)],
  });

  expect(await write(db, (w) => tickShopLine(w, milkLine.id, true))).toBe(
    false,
  );
  expect(await write(db, (w) => tickShopLine(w, riceLine.id, true))).toBe(true);
  expect(await write(db, (w) => tickShopLine(w, riceLine.id, false))).toBe(
    false,
  );
});

test("lines_can_be_ticked_and_removed", async () => {
  const shop = aShop("Corner shop");
  const milkLine = aShopLine(shop, milk, 1);
  const riceLine = aShopLine(shop, rice, 1);
  await seed(db, {
    items: [milk, rice],
    shops: [shop],
    shopLines: [milkLine, riceLine],
  });

  await write(db, async (w) => {
    await tickShopLine(w, milkLine.id, true);
    await removeShopLine(w, riceLine.id, now);
  });

  expect(await live(db, "shopLines")).toMatchObject([
    { id: milkLine.id, ticked: true },
  ]);
});

test("to_extras_puts_the_lines_count_on_the_extras_list_as_once_and_removes_the_line", async () => {
  const shop = aShop("Corner shop");
  const line = aShopLine(shop, milk, 3);
  await seed(db, { items: [milk], shops: [shop], shopLines: [line] });

  await write(db, (w) => lineToWanted(w, line.id, now));

  expect(await live(db, "wantedLines")).toMatchObject([
    { itemId: milk.id, count: 3, weekly: false },
  ]);
  expect(await live(db, "shopLines")).toEqual([]);
});

test("to_extras_adds_the_lines_count_to_an_extras_line_already_there", async () => {
  const shop = aShop("Corner shop");
  const line = aShopLine(shop, milk, 3);
  await seed(db, {
    items: [milk],
    shops: [shop],
    shopLines: [line],
    wantedLines: [aWantedLine(milk, 1, true)],
  });

  await write(db, (w) => lineToWanted(w, line.id, now));

  expect(await live(db, "wantedLines")).toMatchObject([
    { itemId: milk.id, count: 4, weekly: true },
  ]);
});

test("to_extras_brings_a_deleted_item_back", async () => {
  const shop = aShop("Corner shop");
  const deletedMilk = { ...milk, deletedAt: now };
  const deletedRice = { ...rice, deletedAt: now };
  const milkLine = aShopLine(shop, deletedMilk, 2);
  const riceLine = aShopLine(shop, deletedRice, 1);
  await seed(db, {
    items: [deletedMilk, deletedRice],
    shops: [shop],
    shopLines: [milkLine, riceLine],
  });

  await write(db, (w) => lineToWanted(w, milkLine.id, now));
  await write(db, (w) => restToWanted(w, shop.id, now));

  expect(await db.items.get(milk.id)).toMatchObject({ deletedAt: null });
  expect(await db.items.get(rice.id)).toMatchObject({ deletedAt: null });
  const countsByItem = new Map(
    (await live(db, "wantedLines")).map((line) => [line.itemId, line.count]),
  );
  expect(countsByItem).toEqual(
    new Map([
      [milk.id, 2],
      [rice.id, 1],
    ]),
  );
});

test("rest_to_extras_moves_every_unticked_line", async () => {
  const shop = aShop("Corner shop");
  const tickedLine = { ...aShopLine(shop, rice, 1), ticked: true };
  await seed(db, {
    items: [milk, rice, naan],
    shops: [shop],
    shopLines: [aShopLine(shop, milk, 2), aShopLine(shop, naan, 1), tickedLine],
  });

  await write(db, (w) => restToWanted(w, shop.id, now));

  const wantedLines = await live(db, "wantedLines");
  expect(wantedLines.map((line) => [line.itemId, line.count]).sort()).toEqual(
    [
      [milk.id, 2],
      [naan.id, 1],
    ].sort(),
  );
  expect((await live(db, "shopLines")).map((line) => line.id)).toEqual([
    tickedLine.id,
  ]);
});

test("delete_discards_the_shop_and_leaves_the_plan", async () => {
  await seedPlan();
  const shop = await write(db, (w) => generateShop(w, "Big shop", now));
  const plannedMealsBefore = await live(db, "plannedMeals");

  await write(db, (w) => deleteShop(w, shop.id, now));

  expect(await live(db, "shops")).toEqual([]);
  expect(await live(db, "shopLines")).toEqual([]);
  expect(await live(db, "plannedMeals")).toEqual(plannedMealsBefore);
});

test("share_produces_the_unticked_lines_as_text", () => {
  const shop = aShop("Corner shop");
  const lines = [
    aShopLine(shop, milk, 2),
    { ...aShopLine(shop, naan, 1), nameOverride: "Garlic naan" },
    { ...aShopLine(shop, rice, 1), ticked: true },
    { ...aShopLine(shop, rice, 4), deletedAt: now },
  ];

  expect(shopText(shop, lines, [rice, naan, milk])).toBe(
    "Milk ×2, 4 pints\nGarlic naan ×1",
  );
});
