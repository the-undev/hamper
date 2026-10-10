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
  linesOnDay,
  plannedMealsAt,
  seed,
  thePlan,
} from "@/test/rows";

let db: HamperDb;

const rice = anItem("Rice", "1kg bag");
const naan = anItem("Naan");
const curry = aMeal("Curry");
const chilli = aMeal("Chilli");
const tuesday = formatDay("2026-06-02");

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [rice, naan],
    meals: [curry, chilli],
    mealLines: [aMealLine(curry, rice, 1), aMealLine(curry, naan, 2)],
    plan: [thePlan("2026-06-01", 7)],
  });
});

afterEach(async () => {
  await db.delete();
});

/** Opens the picker for Tuesday from the Plan, as a tap on its "Add a meal" row does. */
async function openFromPlan() {
  const app = renderApp("/plan", db, fakeLoop());
  await app.user.click(
    await screen.findByRole("link", { name: `Add a meal to ${tuesday}` }),
  );
  await screen.findByRole("heading", { name: `Add a meal to ${tuesday}` });
  return app;
}

function libraryRows(): string[] {
  return within(screen.getByRole("list", { name: "Library" }))
    .getAllByRole("button")
    .map((row) => row.textContent ?? "");
}

test("the_picker_is_a_screen_with_the_box_focused_and_the_library_listed", async () => {
  const { router } = await openFromPlan();

  expect(router.state.location.pathname).toBe("/plan/pick/1");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Meal")).toHaveFocus();
  await waitFor(() =>
    expect(libraryRows()).toEqual(["CChilli", "CCurryNaan, Rice"]),
  );
  expect(screen.queryByText("Or a meal of its own")).not.toBeInTheDocument();
});

test("typing_filters_the_library_and_offers_a_meal_of_its_own_after_it", async () => {
  const { user } = await openFromPlan();

  await user.type(screen.getByLabelText("Meal"), "cur");

  expect(libraryRows()).toEqual(["CCurryNaan, Rice"]);
  const ownMeal = screen.getByRole("list", { name: "Or a meal of its own" });
  expect(within(ownMeal).getByRole("button")).toHaveTextContent(
    "Use “cur” as it is",
  );

  await user.type(screen.getByLabelText("Meal"), "ious");

  expect(
    screen.queryByRole("list", { name: "Library" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Use “curious” as it is" }),
  ).toBeInTheDocument();
});

test("a_meals_exact_name_offers_no_meal_of_its_own", async () => {
  const { user } = await openFromPlan();

  await user.type(screen.getByLabelText("Meal"), " curry ");

  expect(libraryRows()).toEqual(["CCurryNaan, Rice"]);
  expect(screen.queryByText("Or a meal of its own")).not.toBeInTheDocument();
});

test("picking_a_meal_places_it_with_its_lines_and_goes_back_to_the_plan", async () => {
  const { user, router } = await openFromPlan();

  await user.click(await screen.findByRole("button", { name: /^Curry/ }));

  expect(
    await screen.findByRole("link", { name: /Curry\s*Naan, Rice/ }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/plan");
  expect((await plannedMealsAt(db, 1))[0]).toMatchObject({
    name: "Curry",
    mealId: curry.id,
  });
  const countsByItem = new Map(
    (await linesOnDay(db, 1)).map((line) => [line.itemId, line.count]),
  );
  expect(countsByItem).toEqual(
    new Map([
      [rice.id, 1],
      [naan.id, 2],
    ]),
  );
});

test("enter_on_an_exact_name_picks_that_meal", async () => {
  const { user, router } = await openFromPlan();

  await user.type(screen.getByLabelText("Meal"), "chilli{Enter}");

  await waitFor(() => expect(router.state.location.pathname).toBe("/plan"));
  expect((await plannedMealsAt(db, 1))[0]).toMatchObject({
    name: "Chilli",
    mealId: chilli.id,
  });
});

test("enter_on_any_other_name_makes_a_meal_of_its_own_and_opens_it", async () => {
  const { user, router } = await openFromPlan();

  await user.type(screen.getByLabelText("Meal"), "Chil{Enter}");

  expect(await screen.findByLabelText("Name")).toHaveValue("Chil");
  const [adHoc] = await plannedMealsAt(db, 1);
  expect(router.state.location.pathname).toBe(`/plan/meal/${adHoc?.id}`);
  expect(screen.getByText("Not a meal in the library")).toBeInTheDocument();
  expect((await plannedMealsAt(db, 1))[0]).toMatchObject({
    name: "Chil",
    mealId: null,
  });
  expect(await linesOnDay(db, 1)).toEqual([]);

  router.history.back();

  await waitFor(() => expect(router.state.location.pathname).toBe("/plan"));
});

test("opened_with_no_history_picking_goes_to_the_plan", async () => {
  const { user, router } = renderApp("/plan/pick/1", db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: /^Curry/ }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/plan"));
  expect((await plannedMealsAt(db, 1))[0]).toMatchObject({ mealId: curry.id });
});

test("picking_a_meal_adds_it_after_the_meals_already_on_the_day", async () => {
  const soup = aPlannedMeal(1, "Soup");
  await seed(db, { plannedMeals: [soup] });
  const { user, router } = await openFromPlan();

  await user.click(await screen.findByRole("button", { name: /^Curry/ }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/plan"));
  expect(await plannedMealsAt(db, 1)).toMatchObject([
    { id: soup.id, rank: 0 },
    { name: "Curry", mealId: curry.id, rank: 1 },
  ]);
});
