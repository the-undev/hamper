import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { formatDay } from "@/lib/dates";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import {
  aMeal,
  aMealLine,
  anItem,
  aPlannedMeal,
  aPlannedMealLine,
  live,
  now,
  plannedMealsAt,
  seed,
  thePlan,
} from "@/test/rows";

let db: HamperDb;

const rice = anItem("Rice", "1kg bag");
const naan = anItem("Naan");
const curry = aMeal("Curry");
const curryDinner = aPlannedMeal(0, "Curry", curry);

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [rice, naan],
    meals: [curry],
    mealLines: [aMealLine(curry, rice, 1), aMealLine(curry, naan, 2)],
    plan: [thePlan("2026-06-01", 7)],
  });
});

afterEach(async () => {
  await db.delete();
});

function openPlannedMeal(plannedMealId: string) {
  return renderApp(`/plan/meal/${plannedMealId}`, db, fakeLoop());
}

async function countsOn(plannedMealId: string): Promise<Map<string, number>> {
  return new Map(
    (await live(db, "plannedMealLines"))
      .filter((line) => line.plannedMealId === plannedMealId)
      .map((line) => [line.itemId, line.count]),
  );
}

test("the_header_shows_the_day_the_planned_meal_is_on", async () => {
  const lunch = aPlannedMeal(2, "Soup", null, 1);
  await seed(db, { plannedMeals: [lunch] });
  openPlannedMeal(lunch.id);

  expect(
    await screen.findByRole("heading", { name: formatDay("2026-06-03") }),
  ).toBeInTheDocument();
  expect(await screen.findByLabelText("Name")).toHaveValue("Soup");
});

test("reset_restores_the_meals_lines_on_a_changed_planned_meal", async () => {
  await seed(db, {
    plannedMeals: [curryDinner],
    plannedMealLines: [aPlannedMealLine(curryDinner, rice, 3)],
  });
  const { user } = openPlannedMeal(curryDinner.id);

  expect(
    await screen.findByText("From the meal Curry, changed for this day"),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reset to the meal" }));

  expect(await screen.findByText("From the meal Curry")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Reset to the meal" }),
  ).toBeDisabled();
  expect(await countsOn(curryDinner.id)).toEqual(
    new Map([
      [rice.id, 1],
      [naan.id, 2],
    ]),
  );
});

test("the_name_is_edited_for_that_planned_meal_only", async () => {
  await seed(db, { plannedMeals: [curryDinner] });
  const { user } = openPlannedMeal(curryDinner.id);

  const nameBox = await screen.findByLabelText("Name");
  await user.clear(nameBox);
  await user.type(nameBox, "Curry and rice{Enter}");

  await waitFor(async () =>
    expect((await db.plannedMeals.get(curryDinner.id))?.name).toBe(
      "Curry and rice",
    ),
  );
  expect((await db.meals.get(curry.id))?.name).toBe("Curry");
  expect(screen.getByText(/^From the meal Curry/)).toBeInTheDocument();
});

test("save_as_a_meal_puts_an_ad_hoc_planned_meal_in_the_library_and_links_it", async () => {
  const leftovers = aPlannedMeal(1, "Leftovers");
  await seed(db, {
    plannedMeals: [leftovers],
    plannedMealLines: [aPlannedMealLine(leftovers, naan, 1)],
  });
  const { user } = openPlannedMeal(leftovers.id);

  expect(
    await screen.findByText("Not a meal in the library"),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save as a meal" }));

  expect(
    await screen.findByText("From the meal Leftovers"),
  ).toBeInTheDocument();
  const savedMeal = (await live(db, "meals")).find(
    (meal) => meal.name === "Leftovers",
  );
  expect((await db.plannedMeals.get(leftovers.id))?.mealId).toBe(savedMeal?.id);
  expect(
    (await live(db, "mealLines")).filter(
      (line) => line.mealId === savedMeal?.id,
    ),
  ).toMatchObject([{ itemId: naan.id, count: 1 }]);
});

test("remove_from_day_removes_only_this_meal_and_goes_back_to_the_plan", async () => {
  const pudding = aPlannedMeal(0, "Rice pudding", null, 1);
  await seed(db, {
    plannedMeals: [curryDinner, pudding],
    plannedMealLines: [aPlannedMealLine(curryDinner, rice, 1)],
  });
  const { user, router } = openPlannedMeal(curryDinner.id);

  await user.click(
    await screen.findByRole("button", { name: "Remove from day" }),
  );

  await waitFor(() => expect(router.state.location.pathname).toBe("/plan"));
  expect(await plannedMealsAt(db, 0)).toMatchObject([
    { id: pudding.id, rank: 0 },
  ]);
  expect(await countsOn(curryDinner.id)).toEqual(new Map());
});

test("the_lines_are_added_counted_and_removed_for_that_planned_meal_only", async () => {
  const pudding = aPlannedMeal(0, "Rice pudding", null, 1);
  await seed(db, {
    plannedMeals: [curryDinner, pudding],
    plannedMealLines: [
      aPlannedMealLine(curryDinner, rice, 1),
      aPlannedMealLine(curryDinner, naan, 2),
      aPlannedMealLine(pudding, rice, 1),
    ],
  });
  const { user } = openPlannedMeal(curryDinner.id);

  const typeAhead = await screen.findByLabelText("Add an item for this day");
  await user.type(typeAhead, "Bread{Enter}");
  await user.type(typeAhead, "rice{Enter}");
  await user.click(screen.getByRole("button", { name: "One more Rice" }));
  await user.click(screen.getByRole("button", { name: "Remove Naan" }));

  // The add writes after Enter returns, so Bread is looked up inside the wait.
  await waitFor(async () => {
    const bread = (await live(db, "items")).find(
      (item) => item.name === "Bread",
    );
    expect(await countsOn(curryDinner.id)).toEqual(
      new Map([
        [rice.id, 3],
        [bread?.id, 1],
      ]),
    );
  });
  expect(await countsOn(pudding.id)).toEqual(new Map([[rice.id, 1]]));
  expect(await live(db, "mealLines")).toHaveLength(2);
});

test("a_planned_meal_whose_meal_was_deleted_says_so_and_offers_no_reset", async () => {
  await seed(db, {
    meals: [{ ...curry, deletedAt: now }],
    plannedMeals: [curryDinner],
  });
  openPlannedMeal(curryDinner.id);

  expect(
    await screen.findByText("The meal it came from has been deleted"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Reset to the meal" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Save as a meal" }),
  ).not.toBeInTheDocument();
});

test("a_planned_meal_no_longer_on_the_plan_says_so", async () => {
  await seed(db, { plannedMeals: [{ ...curryDinner, deletedAt: now }] });
  openPlannedMeal(curryDinner.id);

  expect(
    await screen.findByText("This meal is no longer on the plan."),
  ).toBeInTheDocument();
});

test("the_footer_holds_remove_from_day_then_done", async () => {
  await seed(db, { plannedMeals: [curryDinner] });
  openPlannedMeal(curryDinner.id);
  // The footer above the tab bar is a fieldset, so a group named Screen actions rather than a contentinfo landmark.
  const footer = await screen.findByRole("group", { name: "Screen actions" });

  expect(
    within(footer)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["Remove from day", "Done"]);
});

test("done_goes_back_to_the_screen_the_planned_meal_was_opened_from", async () => {
  await seed(db, { plannedMeals: [curryDinner] });
  const { user, router } = renderApp("/meals", db, fakeLoop());
  await router.navigate({
    to: "/plan/meal/$plannedMealId",
    params: { plannedMealId: curryDinner.id },
  });

  await user.click(await screen.findByRole("button", { name: "Done" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/meals"));
});
