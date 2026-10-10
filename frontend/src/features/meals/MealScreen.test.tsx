import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { HistoryEntry } from "@/api/rest";
import { formatDay, formatTimestampDay } from "@/lib/dates";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeFetch } from "@/test/fake-fetch";
import { fakeLoop, quietStatus } from "@/test/fake-loop";
import {
  aMeal,
  aMealLine,
  anItem,
  aPlannedMeal,
  live,
  plannedMealsAt,
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
      rank: 0,
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

  // The add writes after Enter returns, so Peppers is looked up inside the wait.
  await waitFor(async () => {
    const peppers = (await live(db, "items")).find(
      (item) => item.name === "Peppers",
    );
    expect(await countsOnMeal(curry.id)).toEqual(
      new Map([
        [naan.id, 1],
        [peppers?.id, 1],
      ]),
    );
  });
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
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Delete",
    }),
  );

  await waitFor(() => expect(router.state.location.pathname).toBe("/meals"));
  expect(await live(db, "meals")).toEqual([]);
  expect(await live(db, "mealLines")).toEqual([]);
});

test("add_to_a_day_lists_the_days_with_their_meals_and_adds_at_the_end_of_the_one_tapped", async () => {
  const fajitas = aPlannedMeal(0, "Fajitas");
  await seed(db, { plannedMeals: [fajitas] });
  const { user } = renderApp(`/meals/${curry.id}`, db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: "Add to a day" }));

  const sheet = await screen.findByRole("dialog", { name: "Add to a day" });
  expect(
    within(sheet)
      .getAllByRole("button")
      .map((day) => day.textContent),
  ).toEqual([
    `${formatDay("2026-06-01")}1 meal`,
    `${formatDay("2026-06-02")}nothing planned`,
    `${formatDay("2026-06-03")}nothing planned`,
  ]);
  expect(screen.queryByText(/^On \d+ day/)).not.toBeInTheDocument();

  await user.click(
    within(sheet).getByRole("button", {
      name: new RegExp(formatDay("2026-06-01")),
    }),
  );

  expect(await screen.findByText("On 1 day")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(await plannedMealsAt(db, 0)).toMatchObject([
    { id: fajitas.id, rank: 0 },
    { name: "Curry", mealId: curry.id, rank: 1 },
  ]);
});

test("on_n_days_counts_the_days_within_the_length_that_hold_the_meal", async () => {
  await seed(db, {
    plannedMeals: [
      aPlannedMeal(0, "Curry", curry),
      aPlannedMeal(0, "Curry again", curry, 1),
      aPlannedMeal(2, "Curry", curry),
      aPlannedMeal(5, "Curry", curry),
    ],
  });
  renderApp(`/meals/${curry.id}`, db, fakeLoop());

  expect(await screen.findByText("On 2 days")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add to a day" })).toBeEnabled();
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

test("change_photo_is_disabled_with_a_note_while_offline", async () => {
  renderApp(
    `/meals/${curry.id}`,
    db,
    fakeLoop({ ...quietStatus, online: false }),
  );

  expect(
    await screen.findByRole("button", { name: "Change photo" }),
  ).toBeDisabled();
  expect(
    screen.getByText("Changing the photo needs a connection to the server."),
  ).toBeInTheDocument();
});

test("done_in_the_footer_goes_to_the_meals_when_the_meal_was_opened_directly", async () => {
  const { user, router } = renderApp(`/meals/${curry.id}`, db, fakeLoop());
  // The footer above the tab bar is a fieldset, so a group named Screen actions rather than a contentinfo landmark.
  const footer = await screen.findByRole("group", { name: "Screen actions" });

  await user.click(within(footer).getByRole("button", { name: "Done" }));

  await waitFor(() => expect(router.state.location.pathname).toBe("/meals"));
});
