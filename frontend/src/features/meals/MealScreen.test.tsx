import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { HistoryEntry } from "@/api/rest";
import { formatDay, formatTimestampDay } from "@/lib/dates";
import type { HamperDb } from "@/store/db";
import { dayIdFor } from "@/store/ids";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeFetch } from "@/test/fake-fetch";
import { fakeLoop } from "@/test/fake-loop";
import {
  aDay,
  aMeal,
  aMealLine,
  anItem,
  live,
  seed,
  thePlan,
} from "@/test/rows";

let db: HamperDb;

const rice = anItem("Rice", "1kg bag");
const naan = anItem("Naan");
const curry = aMeal("Curry");
const riceLine = aMealLine(curry, rice, 1);
const naanLine = aMealLine(curry, naan, 2);

function historyEntry(archivedAt: string, mealIds: string[]): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    name: "Shop",
    createdAt: archivedAt,
    archivedAt,
    planStartDate: "2026-05-01",
    planLengthDays: 7,
    meals: mealIds.map((mealId, position) => ({
      position,
      name: "A meal",
      mealId,
    })),
    lineCount: 3,
  };
}

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [rice, naan],
    meals: [curry],
    mealLines: [riceLine, naanLine],
    plan: [thePlan("2026-06-01", 3)],
  });
  fakeFetch({ "GET /api/history": () => Response.json([]) });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

async function countsOnMeal(mealId: string): Promise<Map<string, number>> {
  return new Map(
    (await live(db, "mealLines"))
      .filter((line) => line.mealId === mealId)
      .map((line) => [line.itemId, line.count]),
  );
}

test("the_meals_lines_are_added_counted_and_removed", async () => {
  const { user } = renderApp(`/meals/${curry.id}`, db, fakeLoop());

  const typeAhead = await screen.findByLabelText("Add an item to this meal");
  await user.type(typeAhead, "Peppers{Enter}");
  await user.type(typeAhead, "rice{Enter}");
  await user.click(screen.getByRole("button", { name: "One fewer Naan" }));
  await user.click(screen.getByRole("button", { name: "Remove Rice" }));

  const peppers = (await live(db, "items")).find(
    (item) => item.name === "Peppers",
  );
  await waitFor(async () =>
    expect(await countsOnMeal(curry.id)).toEqual(
      new Map([
        [naan.id, 1],
        [peppers?.id, 1],
      ]),
    ),
  );
});

test("the_name_is_edited_in_place", async () => {
  const { user } = renderApp(`/meals/${curry.id}`, db, fakeLoop());

  const name = await screen.findByLabelText("Name");
  await user.clear(name);
  await user.type(name, "Chicken curry{Enter}");

  await waitFor(async () =>
    expect((await db.meals.get(curry.id))?.name).toBe("Chicken curry"),
  );
});

test("duplicate_copies_the_meal_and_its_lines_and_opens_the_copy", async () => {
  const { user, router } = renderApp(`/meals/${curry.id}`, db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: "Duplicate" }));

  expect(await screen.findByDisplayValue("Curry (copy)")).toBeInTheDocument();
  const copy = (await live(db, "meals")).find(
    (meal) => meal.name === "Curry (copy)",
  );
  expect(router.state.location.pathname).toBe(`/meals/${copy?.id}`);
  expect(await countsOnMeal(copy?.id ?? "")).toEqual(
    new Map([
      [rice.id, 1],
      [naan.id, 2],
    ]),
  );
});

test("delete_removes_the_meal_after_a_confirm", async () => {
  const { user, router } = renderApp(`/meals/${curry.id}`, db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: "Delete" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete",
    }),
  );

  await waitFor(() => expect(router.state.location.pathname).toBe("/meals"));
  expect(await live(db, "meals")).toEqual([]);
  expect(await live(db, "mealLines")).toEqual([]);
});

test("add_to_the_next_empty_day_places_the_meal_and_then_says_it_is_on_the_plan", async () => {
  await seed(db, { days: [aDay(0, "Fajitas")] });
  const { user } = renderApp(`/meals/${curry.id}`, db, fakeLoop());

  await user.click(
    await screen.findByRole("button", {
      name: `Add to ${formatDay("2026-06-02")}`,
    }),
  );

  expect(
    await screen.findByRole("button", { name: "On the plan" }),
  ).toBeDisabled();
  expect(await db.days.get(dayIdFor(1))).toMatchObject({
    name: "Curry",
    mealId: curry.id,
  });
});

test("last_shopped_comes_from_the_newest_archived_shop_holding_the_meal", async () => {
  fakeFetch({
    "GET /api/history": () =>
      Response.json([
        historyEntry("2026-05-20T18:00:00.000Z", ["other"]),
        historyEntry("2026-05-13T18:00:00.000Z", ["other", curry.id]),
        historyEntry("2026-05-06T18:00:00.000Z", [curry.id]),
      ]),
  });
  renderApp(`/meals/${curry.id}`, db, fakeLoop());

  expect(
    await screen.findByText(
      `Last shopped ${formatTimestampDay("2026-05-13T18:00:00.000Z")}`,
    ),
  ).toBeInTheDocument();
});

test("last_shopped_shows_nothing_when_history_cannot_be_read", async () => {
  fakeFetch({
    "GET /api/history": () => {
      throw new TypeError("Failed to fetch");
    },
  });
  renderApp(`/meals/${curry.id}`, db, fakeLoop());

  expect(await screen.findByLabelText("Name")).toHaveValue("Curry");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.queryByText(/shopped/)).not.toBeInTheDocument();
});
