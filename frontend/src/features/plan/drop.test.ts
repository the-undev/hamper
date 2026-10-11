import { expect, test } from "vitest";
import type { PlannedMeal } from "@/store/types";
import { aPlannedMeal } from "@/test/rows";
import {
  type DropData,
  dropPlace,
  type Landing,
  landAt,
  landingPlace,
  lift,
  orderOf,
  putDown,
  rowsOf,
  settle,
  shownOrder,
} from "./drop";

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

function lifted(plannedMeal: PlannedMeal): Landing {
  const landing = lift(orderOf(mealsByPosition), plannedMeal.id);
  if (!landing) {
    throw new Error(`${plannedMeal.name} is not on the plan`);
  }
  return landing;
}

function namesIn(
  order: ReadonlyMap<number, readonly string[]>,
  position: number,
): string[] {
  const names = new Map(
    [...mealsByPosition.values()].flat().map((meal) => [meal.id, meal.name]),
  );
  return (order.get(position) ?? []).map((id) => names.get(id) ?? id);
}

test("a_lifted_meal_starts_from_the_live_order_where_it_is", () => {
  const landing = lifted(curry);

  expect(landing).toMatchObject({
    id: curry.id,
    source: { position: 0, rank: 1 },
    held: true,
  });
  expect(namesIn(landing.order, 0)).toEqual(["Soup", "Curry", "Pudding"]);
  expect(namesIn(landing.order, 1)).toEqual(["Roast"]);
});

test("landing_on_another_day_moves_the_meal_there_at_its_rank", () => {
  const landing = landAt(lifted(curry), { position: 1, rank: 0 });

  expect(namesIn(landing.order, 0)).toEqual(["Soup", "Pudding"]);
  expect(namesIn(landing.order, 1)).toEqual(["Curry", "Roast"]);
  expect(landingPlace(landing)).toEqual({ position: 1, rank: 0 });
  expect(
    namesIn(landAt(lifted(curry), { position: 4, rank: 9 }).order, 4),
  ).toEqual(["Curry"]);
});

test("landing_within_its_day_reorders_the_day", () => {
  const landing = landAt(lifted(soup), { position: 0, rank: 2 });

  expect(namesIn(landing.order, 0)).toEqual(["Curry", "Pudding", "Soup"]);
  expect(landAt(landing, { position: 0, rank: 2 })).toBe(landing);
});

test("a_pointer_over_a_rows_upper_half_lands_before_it_and_its_lower_half_after", () => {
  expect(dropPlace(lifted(soup), overMeal(roast), false)).toEqual({
    position: 1,
    rank: 0,
  });
  expect(dropPlace(lifted(soup), overMeal(roast), true)).toEqual({
    position: 1,
    rank: 1,
  });
  expect(dropPlace(lifted(soup), overMeal(pudding), false)).toEqual({
    position: 0,
    rank: 1,
  });
});

test("its_own_slot_keeps_the_meal_where_it_would_land_and_its_stand_in_takes_it_back", () => {
  const landing = landAt(lifted(soup), { position: 1, rank: 1 });

  expect(dropPlace(landing, overMeal(soup), false)).toEqual({
    position: 1,
    rank: 1,
  });
  expect(dropPlace(landing, { kind: "standIn" }, null)).toEqual({
    position: 0,
    rank: 0,
  });
  expect(dropPlace(landing, undefined, null)).toBeNull();
});

test("a_day_or_its_add_a_meal_row_appends", () => {
  expect(dropPlace(lifted(soup), overDay(1), null)).toEqual({
    position: 1,
    rank: 1,
  });
  expect(dropPlace(lifted(soup), overDay(4), false)).toEqual({
    position: 4,
    rank: 0,
  });
  expect(dropPlace(lifted(soup), overDay(0), null)).toEqual({
    position: 0,
    rank: 2,
  });
});

test("the_keyboard_takes_a_rows_place_after_it_from_above_and_before_it_from_below", () => {
  expect(dropPlace(lifted(soup), overMeal(curry), null)).toEqual({
    position: 0,
    rank: 1,
  });
  expect(dropPlace(lifted(pudding), overMeal(curry), null)).toEqual({
    position: 0,
    rank: 1,
  });
  expect(dropPlace(lifted(pudding), overMeal(roast), null)).toEqual({
    position: 1,
    rank: 0,
  });
  const belowRoast = landAt(lifted(soup), { position: 1, rank: 1 });
  expect(dropPlace(belowRoast, overMeal(roast), null)).toEqual({
    position: 1,
    rank: 0,
  });
});

test("a_held_meal_that_would_land_elsewhere_leaves_a_stand_in_where_it_came_from", () => {
  const landing = landAt(lifted(soup), { position: 0, rank: 1 });

  expect(rowsOf(landing.order, 0, landing)).toEqual([
    { id: soup.id, standIn: true },
    { id: curry.id, standIn: false },
    { id: soup.id, standIn: false },
    { id: pudding.id, standIn: false },
  ]);
  expect(rowsOf(lifted(soup).order, 0, lifted(soup))).toEqual(
    [soup, curry, pudding].map((meal) => ({ id: meal.id, standIn: false })),
  );
  const putDownLanding = putDown(landing);
  expect(
    putDownLanding && rowsOf(putDownLanding.order, 0, putDownLanding),
  ).toEqual(
    [curry, soup, pudding].map((meal) => ({ id: meal.id, standIn: false })),
  );
});

test("a_put_down_meal_shows_where_it_landed_until_the_live_data_has_it_there", () => {
  const landing = putDown(landAt(lifted(curry), { position: 1, rank: 1 }));
  if (!landing) {
    throw new Error("The move was lost");
  }

  expect(namesIn(shownOrder(mealsByPosition, landing), 1)).toEqual([
    "Roast",
    "Curry",
  ]);
  expect(settle(landing, mealsByPosition)).toBe(landing);

  const written = new Map<number, PlannedMeal[]>([
    [0, [soup, pudding]],
    [1, [roast, { ...curry, position: 1, rank: 1 }]],
  ]);
  expect(shownOrder(written, landing)).toEqual(shownOrder(written, null));
  expect(settle(landing, written)).toBeNull();
});

test("a_held_meal_is_never_settled", () => {
  const landing = lifted(curry);

  expect(settle(landing, mealsByPosition)).toBe(landing);
});

test("a_meal_put_back_where_it_came_from_is_discarded", () => {
  const landing = landAt(lifted(curry), { position: 1, rank: 0 });

  expect(putDown(landAt(landing, { position: 0, rank: 1 }))).toBeNull();
  expect(putDown(lifted(curry))).toBeNull();
  expect(shownOrder(mealsByPosition, null)).toEqual(orderOf(mealsByPosition));
});

test("the_shown_order_keeps_a_meal_added_meanwhile_and_drops_one_removed", () => {
  const landing = landAt(lifted(curry), { position: 1, rank: 0 });
  const stew = aPlannedMeal(1, "Stew", null, 1);
  const changed = new Map<number, PlannedMeal[]>([
    [0, [soup, curry]],
    [1, [roast, stew]],
  ]);

  const shown = shownOrder(changed, landing);

  expect(shown.get(0)).toEqual([soup.id]);
  expect(shown.get(1)).toEqual([curry.id, roast.id, stew.id]);
});
