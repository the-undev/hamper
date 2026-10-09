import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { planId } from "@/store/ids";
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
import { byPlanOrder, dayDate } from "./display";
import { deleteMeal, setMealLine } from "./meals";
import {
  adjustPlanLength,
  clearDay,
  copyMealsFromArchived,
  movePlannedMeal,
  placeAdHoc,
  placeMeal,
  removePlannedMeal,
  renamePlannedMeal,
  resetPlannedMeal,
  savePlannedMealAsMeal,
  setPlannedMealLine,
  setPlanStart,
  startNewPlan,
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

/** The live planned meals of the day at a position in their order, each with its rank, name, link and live lines as item id and count. */
async function mealsOn(position: number) {
  const lines = await live(db, "plannedMealLines");
  return (await live(db, "plannedMeals"))
    .filter((plannedMeal) => plannedMeal.position === position)
    .sort(byPlanOrder)
    .map((plannedMeal) => ({
      rank: plannedMeal.rank,
      name: plannedMeal.name,
      mealId: plannedMeal.mealId,
      lines: lines
        .filter((line) => line.plannedMealId === plannedMeal.id)
        .map((line) => [line.itemId, line.count])
        .sort(),
    }));
}

/** The names on the day at a position, in their order. */
async function namesOn(position: number) {
  return (await mealsOn(position)).map((plannedMeal) => plannedMeal.name);
}

const curryLines = [
  [naan.id, 2],
  [rice.id, 1],
].sort();

const curryOn = (rank: number) => ({
  rank,
  name: "Curry",
  mealId: curry.id,
  lines: curryLines,
});

/** Places ad-hoc meals with the names on the day at a position, in order, and returns their ids. */
async function placeAll(position: number, names: readonly string[]) {
  const ids: string[] = [];
  for (const name of names) {
    ids.push((await write(db, (w) => placeAdHoc(w, position, name))).id);
  }
  return ids;
}

test("moving_the_start_date_relabels_every_day_and_moves_nothing", async () => {
  await write(db, (w) => placeMeal(w, 2, curry.id));

  await write(db, (w) => setPlanStart(w, "2026-06-08"));

  const plan = await db.plan.get(planId);
  expect(plan && dayDate(plan, 2)).toBe("2026-06-10");
  expect(await mealsOn(2)).toEqual([curryOn(0)]);
});

test("the_length_moves_a_day_at_a_time_from_1_to_31_days", async () => {
  await seed(db, { plan: [thePlan("2026-06-01", 30)] });
  await write(db, (w) => adjustPlanLength(w, 1));
  expect((await db.plan.get(planId))?.lengthDays).toBe(31);
  await expect(write(db, (w) => adjustPlanLength(w, 1))).rejects.toThrow(
    DomainError,
  );

  await seed(db, { plan: [thePlan("2026-06-01", 1)] });
  await expect(write(db, (w) => adjustPlanLength(w, -1))).rejects.toThrow(
    DomainError,
  );
});

test("a_planned_meal_beyond_the_length_is_kept_when_the_length_shrinks", async () => {
  await write(db, (w) => placeMeal(w, 6, curry.id));

  await write(db, (w) => adjustPlanLength(w, -1));

  expect((await db.plan.get(planId))?.lengthDays).toBe(6);
  expect(await mealsOn(6)).toEqual([curryOn(0)]);
});

test("two_length_steps_from_one_shown_length_both_land", async () => {
  const shownPlan = await db.plan.get(planId);

  await Promise.all([
    write(db, (w) => adjustPlanLength(w, 1)),
    write(db, (w) => adjustPlanLength(w, 1)),
  ]);

  expect((await db.plan.get(planId))?.lengthDays).toBe(
    (shownPlan?.lengthDays ?? 0) + 2,
  );
});

test("plan_operations_wait_for_the_plan_to_arrive_from_the_server", async () => {
  await db.plan.clear();

  await expect(write(db, (w) => adjustPlanLength(w, 1))).rejects.toThrow(
    DomainError,
  );
});

test("placing_a_library_meal_copies_its_name_and_lines_into_a_planned_meal_and_keeps_the_link", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id));

  expect(await mealsOn(0)).toEqual([curryOn(0)]);
});

test("a_day_holds_any_number_of_planned_meals_and_placing_appends", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id));
  await write(db, (w) => placeMeal(w, 0, bolognese.id));
  await write(db, (w) => placeAdHoc(w, 0, "Takeaway"));

  expect(await mealsOn(0)).toEqual([
    curryOn(0),
    {
      rank: 1,
      name: "Bolognese",
      mealId: bolognese.id,
      lines: [[pasta.id, 1]],
    },
    { rank: 2, name: "Takeaway", mealId: null, lines: [] },
  ]);
  expect(await mealsOn(1)).toEqual([]);
});

test("placing_on_a_negative_position_is_refused", async () => {
  await expect(write(db, (w) => placeMeal(w, -1, curry.id))).rejects.toThrow(
    DomainError,
  );
  expect(await live(db, "plannedMeals")).toEqual([]);
});

test("typing_a_name_that_matches_no_meal_places_an_ad_hoc_planned_meal_with_no_link_and_no_lines", async () => {
  await write(db, (w) => placeAdHoc(w, 1, "  Takeaway "));

  expect(await mealsOn(1)).toEqual([
    { rank: 0, name: "Takeaway", mealId: null, lines: [] },
  ]);
});

test("lines_can_be_added_to_an_ad_hoc_planned_meal", async () => {
  const leftovers = await write(db, (w) =>
    placeAdHoc(w, 1, "Leftovers and garlic bread"),
  );

  await write(db, (w) => setPlannedMealLine(w, leftovers.id, naan.id, 1, now));

  expect((await mealsOn(1))[0]?.lines).toEqual([[naan.id, 1]]);
});

test("a_planned_meals_lines_are_edited_for_it_only", async () => {
  const placed = await write(db, (w) => placeMeal(w, 0, curry.id));
  await write(db, (w) => placeMeal(w, 0, curry.id));

  await write(db, async (w) => {
    await setPlannedMealLine(w, placed.id, rice.id, 3, now);
    await setPlannedMealLine(w, placed.id, naan.id, 0, now);
  });

  expect(await mealsOn(0)).toEqual([
    { ...curryOn(0), lines: [[rice.id, 3]] },
    curryOn(1),
  ]);
  const mealLines = (await live(db, "mealLines")).filter(
    (line) => line.mealId === curry.id,
  );
  expect(mealLines.map((line) => [line.itemId, line.count]).sort()).toEqual(
    curryLines,
  );
});

test("renaming_a_planned_meal_changes_it_only", async () => {
  const placed = await write(db, (w) => placeMeal(w, 0, curry.id));

  await write(db, (w) =>
    renamePlannedMeal(w, placed.id, "  Curry with extra naan "),
  );

  expect(await mealsOn(0)).toEqual([
    { ...curryOn(0), name: "Curry with extra naan" },
  ]);
  expect((await db.meals.get(curry.id))?.name).toBe("Curry");
});

test("renaming_a_planned_meal_to_an_empty_name_or_one_over_200_characters_is_refused", async () => {
  const placed = await write(db, (w) => placeMeal(w, 0, curry.id));

  await expect(
    write(db, (w) => renamePlannedMeal(w, placed.id, "   ")),
  ).rejects.toThrow(DomainError);
  await expect(
    write(db, (w) => renamePlannedMeal(w, placed.id, "a".repeat(201))),
  ).rejects.toThrow(DomainError);
  expect(await namesOn(0)).toEqual(["Curry"]);
});

test("reset_copies_the_linked_meals_current_lines_back_onto_the_planned_meal", async () => {
  const placed = await write(db, (w) => placeMeal(w, 0, curry.id));
  await write(db, async (w) => {
    await setPlannedMealLine(w, placed.id, rice.id, 4, now);
    await setMealLine(w, curry.id, pasta.id, 1, now);
  });

  await write(db, (w) => resetPlannedMeal(w, placed.id, now));

  expect((await mealsOn(0))[0]?.lines).toEqual(
    [
      [naan.id, 2],
      [pasta.id, 1],
      [rice.id, 1],
    ].sort(),
  );
});

test("reset_does_nothing_when_the_meal_has_been_deleted", async () => {
  const placed = await write(db, (w) => placeMeal(w, 0, curry.id));
  await write(db, async (w) => {
    await setPlannedMealLine(w, placed.id, rice.id, 4, now);
    await deleteMeal(w, curry.id, now);
  });

  await write(db, (w) => resetPlannedMeal(w, placed.id, now));

  expect(await mealsOn(0)).toEqual([
    {
      ...curryOn(0),
      lines: [
        [naan.id, 2],
        [rice.id, 4],
      ].sort(),
    },
  ]);
});

test("save_as_a_meal_puts_an_ad_hoc_planned_meal_into_the_library_and_links_it", async () => {
  const fajitas = await write(db, (w) => placeAdHoc(w, 2, "Fajitas"));
  await write(db, (w) => setPlannedMealLine(w, fajitas.id, rice.id, 2, now));

  const savedMeal = await write(db, (w) =>
    savePlannedMealAsMeal(w, fajitas.id),
  );

  expect(savedMeal.name).toBe("Fajitas");
  expect((await mealsOn(2))[0]?.mealId).toBe(savedMeal.id);
  const savedLines = (await live(db, "mealLines")).filter(
    (line) => line.mealId === savedMeal.id,
  );
  expect(savedLines.map((line) => [line.itemId, line.count])).toEqual([
    [rice.id, 2],
  ]);
});

test("moving_within_a_day_renumbers_ranks", async () => {
  const [porridgeId] = await placeAll(0, ["Porridge", "Soup", "Curry"]);

  await write(db, (w) => movePlannedMeal(w, porridgeId ?? "", 0, 2));

  expect((await mealsOn(0)).map(({ rank, name }) => [rank, name])).toEqual([
    [0, "Soup"],
    [1, "Curry"],
    [2, "Porridge"],
  ]);
});

test("moving_to_another_day_closes_the_gap_and_appends", async () => {
  const [, soupId] = await placeAll(0, ["Porridge", "Soup", "Curry"]);
  await placeAll(3, ["Fish"]);

  await write(db, (w) => movePlannedMeal(w, soupId ?? "", 3, 99));

  expect((await mealsOn(0)).map(({ rank, name }) => [rank, name])).toEqual([
    [0, "Porridge"],
    [1, "Curry"],
  ]);
  expect((await mealsOn(3)).map(({ rank, name }) => [rank, name])).toEqual([
    [0, "Fish"],
    [1, "Soup"],
  ]);
});

test("moving_to_another_day_between_meals_puts_it_there_with_its_lines", async () => {
  const placed = await write(db, (w) => placeMeal(w, 0, curry.id));
  await placeAll(4, ["Porridge", "Fish"]);

  await write(db, (w) => movePlannedMeal(w, placed.id, 4, 1));

  expect(await mealsOn(0)).toEqual([]);
  expect(await namesOn(4)).toEqual(["Porridge", "Curry", "Fish"]);
  expect((await mealsOn(4))[1]).toEqual(curryOn(1));
});

test("moving_to_a_negative_place_is_refused", async () => {
  const [soupId] = await placeAll(0, ["Soup"]);

  await expect(
    write(db, (w) => movePlannedMeal(w, soupId ?? "", 0, -1)),
  ).rejects.toThrow(DomainError);
  await expect(
    write(db, (w) => movePlannedMeal(w, soupId ?? "", -1, 0)),
  ).rejects.toThrow(DomainError);
});

test("removing_a_planned_meal_removes_its_lines_and_the_meals_after_it_move_up", async () => {
  await placeAll(0, ["Porridge"]);
  const placed = await write(db, (w) => placeMeal(w, 0, curry.id));
  await placeAll(0, ["Soup"]);

  await write(db, (w) => removePlannedMeal(w, placed.id, now));

  expect((await mealsOn(0)).map(({ rank, name }) => [rank, name])).toEqual([
    [0, "Porridge"],
    [1, "Soup"],
  ]);
  expect(await live(db, "plannedMealLines")).toEqual([]);
});

test("clearing_a_day_removes_all_its_planned_meals", async () => {
  await write(db, async (w) => {
    await placeMeal(w, 0, curry.id);
    await placeMeal(w, 0, bolognese.id);
    await placeMeal(w, 1, curry.id);
  });

  await write(db, (w) => clearDay(w, 0, now));

  expect(await mealsOn(0)).toEqual([]);
  expect(await mealsOn(1)).toEqual([curryOn(0)]);
  expect(await live(db, "plannedMealLines")).toHaveLength(2);
});

test("one_meal_placed_twice_is_two_independent_copies", async () => {
  await write(db, (w) => placeMeal(w, 0, curry.id));
  const second = await write(db, (w) => placeMeal(w, 1, curry.id));

  await write(db, (w) => setPlannedMealLine(w, second.id, rice.id, 5, now));

  expect((await mealsOn(0))[0]?.lines).toEqual(curryLines);
  expect((await mealsOn(1))[0]?.lines).toEqual(
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

test("start_new_plan_removes_the_once_lines_and_keeps_the_planned_meals_and_weekly_lines", async () => {
  const onceLine = aWantedLine(rice, 1, false);
  const weeklyLine = aWantedLine(naan, 2, true);
  await seed(db, { wantedLines: [onceLine, weeklyLine] });
  await write(db, (w) => placeMeal(w, 0, curry.id));

  await write(db, (w) => startNewPlan(w, now));

  expect((await live(db, "wantedLines")).map((line) => line.id)).toEqual([
    weeklyLine.id,
  ]);
  expect(await mealsOn(0)).toEqual([curryOn(0)]);
});

test("copying_meals_from_a_past_week_fills_each_days_list_replacing_what_was_there", async () => {
  await placeAll(0, ["Takeaway", "Porridge"]);
  const archivedMeals: ShopMeal[] = [
    { position: 0, rank: 0, name: "Curry", mealId: curry.id },
    { position: 1, rank: 0, name: "Out for dinner", mealId: null },
  ];

  await write(db, (w) => copyMealsFromArchived(w, archivedMeals, now));

  expect(await mealsOn(0)).toEqual([curryOn(0)]);
  expect(await mealsOn(1)).toEqual([
    { rank: 0, name: "Out for dinner", mealId: null, lines: [] },
  ]);
});

test("copying_an_archive_restores_each_days_order", async () => {
  const archivedMeals: ShopMeal[] = [
    { position: 2, rank: 1, name: "Curry", mealId: curry.id },
    { position: 2, rank: 2, name: "Pudding", mealId: null },
    { position: 2, rank: 0, name: "Porridge", mealId: null },
    { position: 0, rank: 0, name: "Spag bol", mealId: bolognese.id },
  ];

  await write(db, (w) => copyMealsFromArchived(w, archivedMeals, now));

  expect((await mealsOn(2)).map(({ rank, name }) => [rank, name])).toEqual([
    [0, "Porridge"],
    [1, "Curry"],
    [2, "Pudding"],
  ]);
  expect(await namesOn(0)).toEqual(["Bolognese"]);
});

test("copying_a_meal_since_deleted_makes_an_ad_hoc_planned_meal_with_its_archived_name", async () => {
  await write(db, (w) => deleteMeal(w, bolognese.id, now));

  await write(db, (w) =>
    copyMealsFromArchived(
      w,
      [{ position: 2, rank: 0, name: "Spag bol", mealId: bolognese.id }],
      now,
    ),
  );

  expect(await mealsOn(2)).toEqual([
    { rank: 0, name: "Spag bol", mealId: null, lines: [] },
  ]);
});

test("copying_fills_positions_beyond_the_length_too", async () => {
  await seed(db, { plan: [thePlan("2026-06-01", 3)] });

  await write(db, (w) =>
    copyMealsFromArchived(
      w,
      [{ position: 5, rank: 0, name: "Curry", mealId: curry.id }],
      now,
    ),
  );

  expect(await mealsOn(5)).toEqual([curryOn(0)]);
});

test("copying_clears_the_days_the_archive_does_not_mention", async () => {
  await write(db, async (w) => {
    await placeMeal(w, 0, curry.id);
    await placeMeal(w, 3, bolognese.id);
    await placeMeal(w, 9, bolognese.id);
  });

  await write(db, (w) =>
    copyMealsFromArchived(
      w,
      [{ position: 0, rank: 0, name: "Curry", mealId: curry.id }],
      now,
    ),
  );

  expect(
    (await live(db, "plannedMeals")).map((plannedMeal) => plannedMeal.position),
  ).toEqual([0]);
  expect(await live(db, "plannedMealLines")).toHaveLength(2);
});
