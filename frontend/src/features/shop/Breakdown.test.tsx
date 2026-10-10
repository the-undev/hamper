import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { formatDay } from "@/lib/dates";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import {
  aMeal,
  anItem,
  aPlannedMeal,
  aPlannedMealLine,
  aWantedLine,
  live,
  seed,
  thePlan,
} from "@/test/rows";

let db: HamperDb;

const rice = anItem("Rice", "1kg bag");
const naan = anItem("Naan");
const milk = anItem("Milk", "4 pints");
const curry = aMeal("Curry");
const curryDay = aPlannedMeal(0, "Curry", curry);
const fajitasDay = aPlannedMeal(2, "Fajitas");
const curryRice = aPlannedMealLine(curryDay, rice, 1);

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [rice, naan, milk],
    meals: [curry],
    plan: [thePlan("2026-06-01", 7)],
    plannedMeals: [curryDay, fajitasDay, aPlannedMeal(9, "Beyond the plan")],
    plannedMealLines: [
      curryRice,
      aPlannedMealLine(curryDay, naan, 2),
      aPlannedMealLine(fajitasDay, rice, 1),
    ],
    wantedLines: [aWantedLine(rice, 1), aWantedLine(milk, 2, true)],
  });
});

afterEach(async () => {
  await db.delete();
});

test("make_from_plan_goes_through_the_breakdown_and_generate_sums_the_lines", async () => {
  const { user, router } = renderApp("/shop", db, fakeLoop());

  await user.click(
    await screen.findByRole("button", { name: "Make from plan" }),
  );
  const generate = await screen.findByRole("button", {
    name: "Generate the list",
  });
  expect(screen.queryByText("Beyond the plan")).not.toBeInTheDocument();
  await user.click(generate);

  expect(
    await screen.findByRole("button", {
      name: /^Rice\s*1kg bag · Curry, Fajitas, extras$/,
    }),
  ).toBeInTheDocument();
  const [shop] = await live(db, "shops");
  expect(shop?.name).toBe(`Shop ${formatDay("2026-06-01")}`);
  expect(router.state.location.pathname).toBe(`/shop/${shop?.id}`);
  expect(
    new Map(
      (await live(db, "shopLines")).map((line) => [line.itemId, line.count]),
    ),
  ).toEqual(
    new Map([
      [rice.id, 3],
      [naan.id, 2],
      [milk.id, 2],
    ]),
  );
  expect(
    screen.getByText(
      `Shop ${formatDay("2026-06-01")}, from 2 meals. 0 of 3 in the trolley.`,
    ),
  ).toBeInTheDocument();
});

test("an_edit_in_the_breakdown_is_saved_to_the_plan", async () => {
  const { user } = renderApp("/shop/breakdown", db, fakeLoop());
  const monday = formatDay("2026-06-01");
  const mondaySection = await screen.findByRole("region", { name: monday });
  const currySection = within(mondaySection).getByRole("region", {
    name: "Curry",
  });

  await user.click(
    within(currySection).getByRole("button", { name: "One more Rice" }),
  );
  await user.type(
    within(currySection).getByLabelText(`Add an item for Curry on ${monday}`),
    "milk{Enter}",
  );
  const extrasSection = screen.getByRole("region", { name: "Extras" });
  await user.click(
    within(extrasSection).getByRole("button", { name: "Remove Milk" }),
  );

  await waitFor(async () =>
    expect((await db.plannedMealLines.get(curryRice.id))?.count).toBe(2),
  );
  expect(
    (await live(db, "plannedMealLines")).filter(
      (line) => line.plannedMealId === curryDay.id && line.itemId === milk.id,
    ),
  ).toHaveLength(1);
  expect((await live(db, "wantedLines")).map((line) => line.itemId)).toEqual([
    rice.id,
  ]);
});

test("the_breakdown_lists_every_day_with_its_meals_in_order_and_says_when_nothing_is_planned", async () => {
  await seed(db, {
    plannedMeals: [aPlannedMeal(0, "Rice pudding", null, 1)],
  });
  renderApp("/shop/breakdown", db, fakeLoop());

  const monday = await screen.findByRole("region", {
    name: formatDay("2026-06-01"),
  });
  await waitFor(() =>
    expect(
      within(monday)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Curry", "Rice pudding"]),
  );
  expect(within(monday).getAllByText("this day's meal only")).toHaveLength(1);
  const tuesday = screen.getByRole("region", { name: formatDay("2026-06-02") });
  expect(within(tuesday).getByText("nothing planned")).toBeInTheDocument();
  expect(within(tuesday).queryByText("this day's meal only")).toBeNull();
  expect(
    screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent),
  ).toEqual([
    `${formatDay("2026-06-01")}this day's meal only`,
    formatDay("2026-06-02"),
    `${formatDay("2026-06-03")}this day's meal only`,
    formatDay("2026-06-04"),
    formatDay("2026-06-05"),
    formatDay("2026-06-06"),
    formatDay("2026-06-07"),
    "Extras",
  ]);
});

test("cancel_leaves_the_breakdown_without_making_a_list", async () => {
  const { user, router } = renderApp("/shop/breakdown", db, fakeLoop());

  await user.click(await screen.findByRole("link", { name: "‹ Cancel" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/shop"));
  expect(await live(db, "shops")).toEqual([]);
});
