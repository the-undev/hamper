import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { dayIdFor } from "@/store/ids";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import {
  aDay,
  aDayLine,
  aMeal,
  aMealLine,
  anItem,
  live,
  now,
  seed,
  thePlan,
} from "@/test/rows";

let db: HamperDb;

const rice = anItem("Rice", "1kg bag");
const naan = anItem("Naan");
const curry = aMeal("Curry");
const curryDay = aDay(0, "Curry", curry);

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

async function countsOnDay(position: number): Promise<Map<string, number>> {
  return new Map(
    (await live(db, "dayLines"))
      .filter((line) => line.dayId === dayIdFor(position))
      .map((line) => [line.itemId, line.count]),
  );
}

test("reset_restores_the_meals_lines_on_a_changed_day", async () => {
  await seed(db, { days: [curryDay], dayLines: [aDayLine(curryDay, rice, 3)] });
  const { user } = renderApp("/plan/day/0", db, fakeLoop());

  expect(
    await screen.findByText("From the meal Curry, changed for this day"),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Reset to the meal" }));

  expect(await screen.findByText("From the meal Curry")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Reset to the meal" }),
  ).toBeDisabled();
  expect(await countsOnDay(0)).toEqual(
    new Map([
      [rice.id, 1],
      [naan.id, 2],
    ]),
  );
});

test("the_days_name_is_edited_for_that_day_only", async () => {
  await seed(db, { days: [curryDay] });
  const { user } = renderApp("/plan/day/0", db, fakeLoop());

  const nameBox = await screen.findByLabelText("Name");
  await user.clear(nameBox);
  await user.type(nameBox, "Curry and rice{Enter}");

  await waitFor(async () =>
    expect((await db.days.get(curryDay.id))?.name).toBe("Curry and rice"),
  );
  expect((await db.meals.get(curry.id))?.name).toBe("Curry");
  expect(screen.getByText(/^From the meal Curry/)).toBeInTheDocument();
});

test("save_as_a_meal_puts_an_ad_hoc_day_in_the_library_and_links_it", async () => {
  const leftovers = aDay(1, "Leftovers");
  await seed(db, {
    days: [leftovers],
    dayLines: [aDayLine(leftovers, naan, 1)],
  });
  const { user } = renderApp("/plan/day/1", db, fakeLoop());

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
  expect((await db.days.get(leftovers.id))?.mealId).toBe(savedMeal?.id);
  expect(
    (await live(db, "mealLines")).filter(
      (line) => line.mealId === savedMeal?.id,
    ),
  ).toMatchObject([{ itemId: naan.id, count: 1 }]);
});

test("clear_day_empties_the_day_and_goes_back_to_the_plan", async () => {
  await seed(db, { days: [curryDay], dayLines: [aDayLine(curryDay, rice, 1)] });
  const { user, router } = renderApp("/plan/day/0", db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: "Clear day" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/plan"));
  expect(await live(db, "days")).toEqual([]);
  expect(await countsOnDay(0)).toEqual(new Map());
});

test("the_days_lines_are_added_counted_and_removed_for_that_day_only", async () => {
  await seed(db, {
    days: [curryDay],
    dayLines: [aDayLine(curryDay, rice, 1), aDayLine(curryDay, naan, 2)],
  });
  const { user } = renderApp("/plan/day/0", db, fakeLoop());

  const typeAhead = await screen.findByLabelText("Add an item for this day");
  await user.type(typeAhead, "Bread{Enter}");
  await user.type(typeAhead, "rice{Enter}");
  await user.click(screen.getByRole("button", { name: "One more Rice" }));
  await user.click(screen.getByRole("button", { name: "Remove Naan" }));

  const bread = (await live(db, "items")).find((item) => item.name === "Bread");
  await waitFor(async () =>
    expect(await countsOnDay(0)).toEqual(
      new Map([
        [rice.id, 3],
        [bread?.id, 1],
      ]),
    ),
  );
  expect(await live(db, "mealLines")).toHaveLength(2);
});

test("a_day_whose_meal_was_deleted_says_so_and_offers_no_reset", async () => {
  await seed(db, {
    meals: [{ ...curry, deletedAt: now }],
    days: [curryDay],
  });
  renderApp("/plan/day/0", db, fakeLoop());

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

test("an_empty_day_offers_the_meal_picker", async () => {
  const { user } = renderApp("/plan/day/3", db, fakeLoop());

  await user.type(await screen.findByLabelText("Meal"), "curry{Enter}");

  expect(await screen.findByText("From the meal Curry")).toBeInTheDocument();
  expect(await countsOnDay(3)).toEqual(
    new Map([
      [rice.id, 1],
      [naan.id, 2],
    ]),
  );
});

test("the_footer_holds_clear_day_then_done", async () => {
  await seed(db, { days: [curryDay] });
  renderApp("/plan/day/0", db, fakeLoop());
  // The footer above the tab bar is a fieldset, so a group named Screen actions rather than a contentinfo landmark.
  const footer = await screen.findByRole("group", { name: "Screen actions" });

  expect(
    within(footer)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["Clear day", "Done"]);
});

test("done_goes_back_to_the_screen_the_day_was_opened_from", async () => {
  await seed(db, { days: [curryDay] });
  const { user, router } = renderApp("/meals", db, fakeLoop());
  await router.navigate({
    to: "/plan/day/$position",
    params: { position: "0" },
  });

  await user.click(await screen.findByRole("button", { name: "Done" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/meals"));
});
