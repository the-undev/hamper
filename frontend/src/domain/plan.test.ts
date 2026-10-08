import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { dayIdFor, planId } from "@/store/ids";
import type { ShopMeal } from "@/store/types";
import { write } from "@/store/write";
import { freshDb } from "@/test/db";
import {
  aMeal,
  aMealLine,
  anItem,
  aWantedLine,
  live,
  now,
  seed,
  thePlan,
} from "@/test/rows";
import { DomainError } from "./checks";
import { dayDate } from "./display";
import { deleteMeal, setMealLine } from "./meals";
import {
  clearDay,
  copyMealsFromArchived,
  placeAdHoc,
  placeMeal,
  renameDay,
  resetDay,
  saveDayAsMeal,
  setDayLine,
  setPlanLength,
  setPlanStart,
  startNewPlan,
  swapDays,
} from "./plan";

let db: HamperDb;

const rice = anItem("Rice");
const naan = anItem("Naan");
const pasta = anItem("Pasta");
const curry = aMeal("Curry");
const bolognese = aMeal("Bolognese");

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [rice, naan, pasta],
    meals: [curry, bolognese],
    mealLines: [
      aMealLine(curry, rice, 1),
      aMealLine(curry, naan, 2),
      aMealLine(bolognese, pasta, 1),
    ],
    plan: [thePlan("2026-06-01", 7)],
  });
});

afterEach(async () => {
  await db.delete();
});

/** The live day at a position with its live lines as item id and count. */
async function dayAt(position: number) {
  const day = (await live(db, "days")).find(
    (liveDay) => liveDay.position === position,
  );
  const lines = (await live(db, "dayLines"))
    .filter((line) => line.dayId === dayIdFor(position))
    .map((line) => [line.itemId, line.count])
    .sort();
  return { name: day?.name, mealId: day?.mealId, lines };
}

const curryLines = [
  [naan.id, 2],
  [rice.id, 1],
].sort();

test("moving_the_start_date_relabels_every_day_and_moves_nothing", async () => {
  await write(db, (w) => placeMeal(w, 2, curry.id, now));

  await write(db, (w) => setPlanStart(w, "2026-06-08"));

  const plan = await db.plan.get(planId);
  expect(plan && dayDate(plan, 2)).toBe("2026-06-10");
  expect(await dayAt(2)).toEqual({
    name: "Curry",
    mealId: curry.id,
    lines: curryLines,
  });
});

test("the_length_is_editable_from_1_to_31_days", async () => {
  await write(db, (w) => setPlanLength(w, 31));
  expect((await db.plan.get(planId))?.lengthDays).toBe(31);

  await expect(write(db, (w) => setPlanLength(w, 0))).rejects.toThrow(
    DomainError,
  );
  await expect(write(db, (w) => setPlanLength(w, 32))).rejects.toThrow(
    DomainError,
  );
});

test("plan_operations_wait_for_the_plan_to_arrive_from_the_server", async () => {
  await db.plan.clear();

  await expect(write(db, (w) => setPlanLength(w, 5))).rejects.toThrow(
    DomainError,
  );
});

test("picking_a_library_meal_copies_its_name_and_lines_onto_the_day_and_keeps_the_link", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id, now));

  expect(await dayAt(0)).toEqual({
    name: "Curry",
    mealId: curry.id,
    lines: curryLines,
  });
});

test("one_day_holds_at_most_one_planned_meal", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id, now));

  await write(db, (w) => placeMeal(w, 0, bolognese.id, now));

  expect(await dayAt(0)).toEqual({
    name: "Bolognese",
    mealId: bolognese.id,
    lines: [[pasta.id, 1]],
  });
  expect(await live(db, "days")).toHaveLength(1);
});

test("days_are_identified_by_position", async () => {
  await write(db, (w) => placeMeal(w, 3, curry.id, now));

  expect((await live(db, "days")).map((day) => day.id)).toEqual([dayIdFor(3)]);
});

test("typing_a_name_that_matches_no_meal_makes_an_ad_hoc_day_with_no_link_and_no_lines", async () => {
  await write(db, (w) => placeMeal(w, 1, curry.id, now));

  await write(db, (w) => placeAdHoc(w, 1, "Takeaway", now));

  expect(await dayAt(1)).toEqual({ name: "Takeaway", mealId: null, lines: [] });
});

test("lines_can_be_added_to_an_ad_hoc_day", async () => {
  await write(db, (w) => placeAdHoc(w, 1, "Leftovers and garlic bread", now));

  await write(db, (w) => setDayLine(w, 1, naan.id, 1, now));

  expect((await dayAt(1)).lines).toEqual([[naan.id, 1]]);
});

test("the_days_lines_are_edited_for_that_day_only", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id, now));

  await write(db, async (w) => {
    await setDayLine(w, 0, rice.id, 3, now);
    await setDayLine(w, 0, naan.id, 0, now);
  });

  expect((await dayAt(0)).lines).toEqual([[rice.id, 3]]);
  const mealLines = (await live(db, "mealLines")).filter(
    (line) => line.mealId === curry.id,
  );
  expect(mealLines.map((line) => [line.itemId, line.count]).sort()).toEqual(
    curryLines,
  );
});

test("renaming_a_day_changes_the_day_only", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id, now));

  await write(db, (w) => renameDay(w, 0, "  Curry with extra naan "));

  expect(await dayAt(0)).toEqual({
    name: "Curry with extra naan",
    mealId: curry.id,
    lines: curryLines,
  });
  expect((await db.meals.get(curry.id))?.name).toBe("Curry");
});

test("renaming_a_day_to_an_empty_name_is_refused", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id, now));

  await expect(write(db, (w) => renameDay(w, 0, "   "))).rejects.toThrow(
    DomainError,
  );
  expect((await dayAt(0)).name).toBe("Curry");
});

test("reset_copies_the_linked_meals_current_lines_back_onto_the_day", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id, now));
  await write(db, async (w) => {
    await setDayLine(w, 0, rice.id, 4, now);
    await setMealLine(w, curry.id, pasta.id, 1, now);
  });

  await write(db, (w) => resetDay(w, 0, now));

  expect((await dayAt(0)).lines).toEqual(
    [
      [naan.id, 2],
      [pasta.id, 1],
      [rice.id, 1],
    ].sort(),
  );
});

test("reset_does_nothing_when_the_meal_has_been_deleted", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id, now));
  await write(db, async (w) => {
    await setDayLine(w, 0, rice.id, 4, now);
    await deleteMeal(w, curry.id, now);
  });

  await write(db, (w) => resetDay(w, 0, now));

  expect(await dayAt(0)).toEqual({
    name: "Curry",
    mealId: curry.id,
    lines: [
      [naan.id, 2],
      [rice.id, 4],
    ].sort(),
  });
});

test("save_as_a_meal_puts_an_ad_hoc_day_into_the_library_and_links_the_day_to_it", async () => {
  await write(db, async (w) => {
    await placeAdHoc(w, 2, "Fajitas", now);
    await setDayLine(w, 2, rice.id, 2, now);
  });

  const savedMeal = await write(db, (w) => saveDayAsMeal(w, 2));

  expect(savedMeal.name).toBe("Fajitas");
  expect((await dayAt(2)).mealId).toBe(savedMeal.id);
  const savedLines = (await live(db, "mealLines")).filter(
    (line) => line.mealId === savedMeal.id,
  );
  expect(savedLines.map((line) => [line.itemId, line.count])).toEqual([
    [rice.id, 2],
  ]);
});

test("days_swap_their_names_links_and_lines", async () => {
  await write(db, async (w) => {
    await placeMeal(w, 0, curry.id, now);
    await placeMeal(w, 4, bolognese.id, now);
  });

  await write(db, (w) => swapDays(w, 0, 4, now));

  expect(await dayAt(0)).toEqual({
    name: "Bolognese",
    mealId: bolognese.id,
    lines: [[pasta.id, 1]],
  });
  expect(await dayAt(4)).toEqual({
    name: "Curry",
    mealId: curry.id,
    lines: curryLines,
  });
});

test("swapping_with_an_empty_day_moves_the_meal_and_leaves_its_old_day_empty", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id, now));

  await write(db, (w) => swapDays(w, 0, 5, now));

  expect(await dayAt(5)).toEqual({
    name: "Curry",
    mealId: curry.id,
    lines: curryLines,
  });
  expect((await db.days.get(dayIdFor(0)))?.deletedAt).toBe(now);
  expect(await dayAt(0)).toEqual({
    name: undefined,
    mealId: undefined,
    lines: [],
  });
});

test("a_day_is_cleared", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id, now));

  await write(db, (w) => clearDay(w, 0, now));

  expect(await live(db, "days")).toEqual([]);
  expect(await live(db, "dayLines")).toEqual([]);
});

test("one_meal_placed_on_two_days_is_two_independent_copies", async () => {
  await write(db, async (w) => {
    await placeMeal(w, 0, curry.id, now);
    await placeMeal(w, 1, curry.id, now);
  });

  await write(db, (w) => setDayLine(w, 1, rice.id, 5, now));

  expect((await dayAt(0)).lines).toEqual(curryLines);
  expect((await dayAt(1)).lines).toEqual(
    [
      [naan.id, 2],
      [rice.id, 5],
    ].sort(),
  );
});

test("start_new_plan_moves_the_start_date_on_by_the_length", async () => {
  await write(db, (w) => startNewPlan(w, now));

  expect((await db.plan.get(planId))?.startDate).toBe("2026-06-08");
});

test("start_new_plan_removes_the_once_lines_and_keeps_the_days_and_weekly_lines", async () => {
  const onceLine = aWantedLine(rice, 1, false);
  const weeklyLine = aWantedLine(naan, 2, true);
  await seed(db, { wantedLines: [onceLine, weeklyLine] });
  await write(db, (w) => placeMeal(w, 0, curry.id, now));

  await write(db, (w) => startNewPlan(w, now));

  expect((await live(db, "wantedLines")).map((line) => line.id)).toEqual([
    weeklyLine.id,
  ]);
  expect(await dayAt(0)).toEqual({
    name: "Curry",
    mealId: curry.id,
    lines: curryLines,
  });
});

test("copying_meals_from_a_past_week_fills_the_days_by_position_replacing_what_was_there", async () => {
  await write(db, (w) => placeAdHoc(w, 0, "Takeaway", now));
  const archivedMeals: ShopMeal[] = [
    { position: 0, name: "Curry", mealId: curry.id },
    { position: 1, name: "Out for dinner", mealId: null },
  ];

  await write(db, (w) => copyMealsFromArchived(w, archivedMeals, now));

  expect(await dayAt(0)).toEqual({
    name: "Curry",
    mealId: curry.id,
    lines: curryLines,
  });
  expect(await dayAt(1)).toEqual({
    name: "Out for dinner",
    mealId: null,
    lines: [],
  });
});

test("copying_a_meal_since_deleted_makes_an_ad_hoc_day_with_its_archived_name", async () => {
  await write(db, (w) => deleteMeal(w, bolognese.id, now));

  await write(db, (w) =>
    copyMealsFromArchived(
      w,
      [{ position: 2, name: "Spag bol", mealId: bolognese.id }],
      now,
    ),
  );

  expect(await dayAt(2)).toEqual({ name: "Spag bol", mealId: null, lines: [] });
});

test("copying_fills_positions_beyond_the_length_too", async () => {
  await write(db, (w) => setPlanLength(w, 3));

  await write(db, (w) =>
    copyMealsFromArchived(
      w,
      [{ position: 5, name: "Curry", mealId: curry.id }],
      now,
    ),
  );

  expect(await dayAt(5)).toEqual({
    name: "Curry",
    mealId: curry.id,
    lines: curryLines,
  });
});

test("copying_clears_the_days_the_archive_does_not_mention", async () => {
  await write(db, async (w) => {
    await placeMeal(w, 0, curry.id, now);
    await placeMeal(w, 3, bolognese.id, now);
  });

  await write(db, (w) =>
    copyMealsFromArchived(
      w,
      [{ position: 0, name: "Curry", mealId: curry.id }],
      now,
    ),
  );

  expect((await live(db, "days")).map((day) => day.position)).toEqual([0]);
  expect((await dayAt(3)).lines).toEqual([]);
});
