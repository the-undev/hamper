import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { write } from "@/store/write";
import { freshDb } from "@/test/db";
import {
  aMeal,
  aMealLine,
  anItem,
  live,
  now,
  seed,
  thePlan,
} from "@/test/rows";
import { DomainError } from "./checks";
import {
  createMeal,
  deleteMeal,
  duplicateMeal,
  renameMeal,
  setMealLine,
} from "./meals";
import { placeMeal } from "./plan";

let db: HamperDb;

beforeEach(() => {
  db = freshDb();
});

afterEach(async () => {
  await db.delete();
});

test("a_meal_is_a_name_and_lines", async () => {
  const rice = anItem("Rice");
  await seed(db, { items: [rice] });

  const curry = await write(db, async (w) => {
    const createdMeal = await createMeal(w, " Curry ");
    await setMealLine(w, createdMeal.id, rice.id, 2, now);
    return createdMeal;
  });

  expect(curry.name).toBe("Curry");
  expect(await live(db, "mealLines")).toMatchObject([
    { mealId: curry.id, itemId: rice.id, count: 2 },
  ]);
});

test("a_count_is_a_whole_number_at_least_one", async () => {
  const rice = anItem("Rice");
  const curry = aMeal("Curry");
  await seed(db, { items: [rice], meals: [curry] });

  await expect(
    write(db, (w) => setMealLine(w, curry.id, rice.id, 1.5, now)),
  ).rejects.toThrow(DomainError);
  await expect(
    write(db, (w) => setMealLine(w, curry.id, rice.id, -1, now)),
  ).rejects.toThrow(DomainError);
});

test("setting_a_meal_lines_count_changes_it_and_zero_removes_it", async () => {
  const rice = anItem("Rice");
  const curry = aMeal("Curry");
  await seed(db, {
    items: [rice],
    meals: [curry],
    mealLines: [aMealLine(curry, rice, 1)],
  });

  await write(db, (w) => setMealLine(w, curry.id, rice.id, 3, now));
  expect(await live(db, "mealLines")).toMatchObject([{ count: 3 }]);

  await write(db, (w) => setMealLine(w, curry.id, rice.id, 0, now));
  expect(await live(db, "mealLines")).toEqual([]);
});

test("a_meal_can_be_duplicated_for_a_variant", async () => {
  const rice = anItem("Rice");
  const curry = aMeal("Curry");
  await seed(db, {
    items: [rice],
    meals: [curry],
    mealLines: [aMealLine(curry, rice, 2)],
  });

  const copiedMeal = await write(db, (w) => duplicateMeal(w, curry.id));

  expect(copiedMeal.name).toBe("Curry (copy)");
  const mealLines = await live(db, "mealLines");
  expect(
    mealLines.map((line) => [line.mealId, line.itemId, line.count]).sort(),
  ).toEqual(
    [
      [curry.id, rice.id, 2],
      [copiedMeal.id, rice.id, 2],
    ].sort(),
  );
});

test("changing_a_meal_changes_nothing_already_on_the_plan", async () => {
  const rice = anItem("Rice");
  const naan = anItem("Naan");
  const curry = aMeal("Curry");
  await seed(db, {
    items: [rice, naan],
    meals: [curry],
    mealLines: [aMealLine(curry, rice, 1)],
    plan: [thePlan()],
  });
  await write(db, (w) => placeMeal(w, 0, curry.id, now));

  await write(db, async (w) => {
    await renameMeal(w, curry.id, "Thai curry");
    await setMealLine(w, curry.id, rice.id, 5, now);
    await setMealLine(w, curry.id, naan.id, 1, now);
  });

  expect(await live(db, "days")).toMatchObject([
    { name: "Curry", mealId: curry.id },
  ]);
  expect(await live(db, "dayLines")).toMatchObject([
    { itemId: rice.id, count: 1 },
  ]);
});

test("deleting_a_meal_removes_it_and_its_lines_and_days_keep_their_copy_and_link", async () => {
  const rice = anItem("Rice");
  const curry = aMeal("Curry");
  await seed(db, {
    items: [rice],
    meals: [curry],
    mealLines: [aMealLine(curry, rice, 1)],
    plan: [thePlan()],
  });
  await write(db, (w) => placeMeal(w, 0, curry.id, now));

  await write(db, (w) => deleteMeal(w, curry.id, now));

  expect(await live(db, "meals")).toEqual([]);
  expect(await live(db, "mealLines")).toEqual([]);
  expect(await live(db, "days")).toMatchObject([
    { name: "Curry", mealId: curry.id },
  ]);
  expect(await live(db, "dayLines")).toMatchObject([
    { itemId: rice.id, count: 1 },
  ]);
});
