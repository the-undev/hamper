import { expect, test } from "vitest";
import type { PlannedMeal } from "@/store/types";
import { aPlannedMeal } from "@/test/rows";
import { type DropData, dropPlace } from "./drop";

const soup = aPlannedMeal(0, "Soup", null, 0);
const curry = aPlannedMeal(0, "Curry", null, 1);
const pudding = aPlannedMeal(0, "Pudding", null, 2);
const roast = aPlannedMeal(1, "Roast", null, 0);
const mealsByPosition = new Map<number, PlannedMeal[]>([
  [0, [soup, curry, pudding]],
  [1, [roast]],
]);

function overMeal(plannedMeal: PlannedMeal): DropData {
  return { kind: "meal", plannedMeal };
}

function overDay(position: number): DropData {
  return { kind: "day", position };
}

test("a_pointer_over_a_rows_upper_half_drops_before_it_and_its_lower_half_after", () => {
  expect(dropPlace(soup, overMeal(roast), false, mealsByPosition)).toEqual({
    position: 1,
    rank: 0,
  });
  expect(dropPlace(soup, overMeal(roast), true, mealsByPosition)).toEqual({
    position: 1,
    rank: 1,
  });
  expect(dropPlace(soup, overMeal(pudding), false, mealsByPosition)).toEqual({
    position: 0,
    rank: 1,
  });
});

test("a_day_or_its_add_a_meal_row_appends", () => {
  expect(dropPlace(soup, overDay(1), null, mealsByPosition)).toEqual({
    position: 1,
    rank: 1,
  });
  expect(dropPlace(soup, overDay(4), false, mealsByPosition)).toEqual({
    position: 4,
    rank: 0,
  });
  expect(dropPlace(soup, overDay(0), null, mealsByPosition)).toEqual({
    position: 0,
    rank: 2,
  });
});

test("the_keyboard_takes_the_rows_place_after_it_from_above_and_before_it_from_below", () => {
  expect(dropPlace(soup, overMeal(curry), null, mealsByPosition)).toEqual({
    position: 0,
    rank: 1,
  });
  expect(dropPlace(pudding, overMeal(curry), null, mealsByPosition)).toEqual({
    position: 0,
    rank: 1,
  });
  expect(dropPlace(pudding, overMeal(roast), null, mealsByPosition)).toEqual({
    position: 1,
    rank: 0,
  });
});

test("a_drop_that_leaves_the_meal_where_it_is_is_nothing", () => {
  expect(dropPlace(curry, overMeal(curry), true, mealsByPosition)).toBeNull();
  expect(
    dropPlace(curry, overMeal(pudding), false, mealsByPosition),
  ).toBeNull();
  expect(dropPlace(curry, overMeal(soup), true, mealsByPosition)).toBeNull();
  expect(dropPlace(pudding, overDay(0), null, mealsByPosition)).toBeNull();
  expect(dropPlace(curry, undefined, null, mealsByPosition)).toBeNull();
});
