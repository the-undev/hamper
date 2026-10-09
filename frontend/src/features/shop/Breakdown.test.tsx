import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { formatDay } from "@/lib/dates";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import {
  aDay,
  aDayLine,
  aMeal,
  anItem,
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
const curryDay = aDay(0, "Curry", curry);
const fajitasDay = aDay(2, "Fajitas");
const curryRice = aDayLine(curryDay, rice, 1);

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [rice, naan, milk],
    meals: [curry],
    plan: [thePlan("2026-06-01", 7)],
    days: [curryDay, fajitasDay, aDay(9, "Beyond the plan")],
    dayLines: [
      curryRice,
      aDayLine(curryDay, naan, 2),
      aDayLine(fajitasDay, rice, 1),
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
  const currySection = await screen.findByRole("region", {
    name: `${formatDay("2026-06-01")} Curry`,
  });

  await user.click(
    within(currySection).getByRole("button", { name: "One more Rice" }),
  );
  await user.type(
    within(currySection).getByLabelText(
      `Add an item for ${formatDay("2026-06-01")}`,
    ),
    "milk{Enter}",
  );
  const extrasSection = screen.getByRole("region", { name: "Extras" });
  await user.click(
    within(extrasSection).getByRole("button", { name: "Remove Milk" }),
  );

  await waitFor(async () =>
    expect((await db.dayLines.get(curryRice.id))?.count).toBe(2),
  );
  expect(
    (await live(db, "dayLines")).filter(
      (line) => line.dayId === curryDay.id && line.itemId === milk.id,
    ),
  ).toHaveLength(1);
  expect((await live(db, "wantedLines")).map((line) => line.itemId)).toEqual([
    rice.id,
  ]);
});

test("cancel_leaves_the_breakdown_without_making_a_list", async () => {
  const { user, router } = renderApp("/shop/breakdown", db, fakeLoop());

  await user.click(await screen.findByRole("link", { name: "‹ Cancel" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/shop"));
  expect(await live(db, "shops")).toEqual([]);
});
