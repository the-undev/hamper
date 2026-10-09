import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { formatDay } from "@/lib/dates";
import type { HamperDb } from "@/store/db";
import { planId } from "@/store/ids";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import {
  aMeal,
  aMealLine,
  anItem,
  aPlannedMeal,
  aPlannedMealLine,
  aWantedLine,
  linesOnDay,
  live,
  plannedMealsAt,
  seed,
  thePlan,
} from "@/test/rows";

let db: HamperDb;

const rice = anItem("Rice", "1kg bag");
const naan = anItem("Naan");
const curry = aMeal("Curry");
const monday = formatDay("2026-06-01");
const tuesday = formatDay("2026-06-02");
const sunday = formatDay("2026-06-07");

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
  vi.restoreAllMocks();
  await db.delete();
});

async function dayLinesAt(position: number) {
  return await linesOnDay(db, position);
}

test("changing_the_length_hides_and_shows_days_without_disturbing_the_meals", async () => {
  await seed(db, {
    plannedMeals: [aPlannedMeal(0, "Curry", curry), aPlannedMeal(6, "Roast")],
  });
  const { user } = renderApp("/plan", db, fakeLoop());
  const roastHandle = { name: `Move Roast from ${sunday}` };
  expect(await screen.findByRole("button", roastHandle)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "One fewer day" }));

  expect(await screen.findByText("6 days")).toBeInTheDocument();
  // The header and the day list read the plan through separate live queries, which re-render apart.
  await waitFor(() =>
    expect(screen.queryByRole("button", roastHandle)).not.toBeInTheDocument(),
  );
  expect(
    (await live(db, "plannedMeals")).map((day) => day.position).sort(),
  ).toEqual([0, 6]);

  await user.click(screen.getByRole("button", { name: "One more day" }));

  expect(await screen.findByRole("button", roastHandle)).toBeInTheDocument();
  expect((await db.plan.get(planId))?.lengthDays).toBe(7);
});

test("the_start_date_input_moves_the_start_and_relabels_the_days", async () => {
  await seed(db, { plannedMeals: [aPlannedMeal(0, "Curry", curry)] });
  renderApp("/plan", db, fakeLoop());

  fireEvent.change(await screen.findByLabelText("Start date"), {
    target: { value: "2026-06-03" },
  });

  expect(
    await screen.findByRole("button", {
      name: `Move Curry from ${formatDay("2026-06-03")}`,
    }),
  ).toBeInTheDocument();
  expect((await db.plan.get(planId))?.startDate).toBe("2026-06-03");
});

test("swiping_a_day_reveals_clear_which_empties_the_day", async () => {
  const curryDay = aPlannedMeal(0, "Curry", curry);
  await seed(db, {
    plannedMeals: [curryDay],
    plannedMealLines: [aPlannedMealLine(curryDay, rice, 1)],
  });
  const { user } = renderApp("/plan", db, fakeLoop());

  await user.click(
    await screen.findByRole("button", { name: `Clear ${monday}` }),
  );

  expect(
    await screen.findByRole("button", { name: `Pick a meal for ${monday}` }),
  ).toBeInTheDocument();
  expect(await live(db, "plannedMeals")).toEqual([]);
  expect(await dayLinesAt(0)).toEqual([]);
});

test("start_new_plan_moves_the_date_and_removes_once_lines_after_a_confirm_and_cancel_does_nothing", async () => {
  await seed(db, {
    plannedMeals: [aPlannedMeal(0, "Curry", curry)],
    wantedLines: [aWantedLine(rice, 1, false), aWantedLine(naan, 1, true)],
  });
  const { user } = renderApp("/plan", db, fakeLoop());
  const startNew = {
    name: `Start new plan from ${formatDay("2026-06-08")}`,
  };

  await user.click(await screen.findByRole("button", startNew));
  await user.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Cancel",
    }),
  );

  expect((await db.plan.get(planId))?.startDate).toBe("2026-06-01");
  expect(await live(db, "wantedLines")).toHaveLength(2);

  await user.click(screen.getByRole("button", startNew));
  await user.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: "Start new plan",
    }),
  );

  await waitFor(async () =>
    expect((await db.plan.get(planId))?.startDate).toBe("2026-06-08"),
  );
  expect((await live(db, "wantedLines")).map((line) => line.itemId)).toEqual([
    naan.id,
  ]);
  expect((await live(db, "plannedMeals")).map((day) => day.name)).toEqual([
    "Curry",
  ]);
});

test("the_plan_waits_for_the_server_until_the_first_pull_brings_it", async () => {
  await db.plan.clear();
  renderApp("/plan", db, fakeLoop());

  expect(await screen.findByText(/Waiting for the server/)).toBeInTheDocument();
});

test("the_view_is_remembered", async () => {
  const { user } = renderApp("/plan", db, fakeLoop());

  await user.click(await screen.findByRole("tab", { name: "Extras" }));

  expect(window.localStorage.getItem("hamper.planView")).toBe("items");
});

/** jsdom lays nothing out, so each slot gets a rect from its position, one under another. */
function laySlotsOut(): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const slot = this.closest("[data-position]");
      const top = Number(slot?.getAttribute("data-position") ?? 0) * 70;
      return new DOMRect(0, top, 360, 62);
    },
  );
}

test("dragging_a_day_onto_another_with_the_keyboard_swaps_them", async () => {
  laySlotsOut();
  const curryDay = aPlannedMeal(0, "Curry", curry);
  await seed(db, {
    plannedMeals: [curryDay, aPlannedMeal(1, "Fajitas")],
    plannedMealLines: [aPlannedMealLine(curryDay, rice, 1)],
  });
  const { user } = renderApp("/plan", db, fakeLoop());
  const handle = await screen.findByRole("button", {
    name: `Move Curry from ${monday}`,
  });

  handle.focus();
  await user.keyboard("[Space]");
  await user.keyboard("[ArrowDown]");
  await user.keyboard("[Space]");

  await waitFor(async () =>
    expect((await plannedMealsAt(db, 1))[0]).toMatchObject({
      name: "Curry",
      mealId: curry.id,
    }),
  );
  expect((await plannedMealsAt(db, 0))[0]).toMatchObject({ name: "Fajitas" });
  expect((await dayLinesAt(1)).map((line) => line.itemId)).toEqual([rice.id]);
  expect(
    await screen.findByRole("button", { name: `Move Curry from ${tuesday}` }),
  ).toBeInTheDocument();
});

test("dragging_a_day_onto_an_empty_day_moves_it_and_leaves_its_old_day_empty", async () => {
  laySlotsOut();
  await seed(db, { plannedMeals: [aPlannedMeal(0, "Curry", curry)] });
  const { user } = renderApp("/plan", db, fakeLoop());

  (
    await screen.findByRole("button", { name: `Move Curry from ${monday}` })
  ).focus();
  await user.keyboard("[Space]");
  await user.keyboard("[ArrowDown]");
  await user.keyboard("[ArrowDown]");
  await user.keyboard("[Space]");

  await waitFor(async () =>
    expect((await live(db, "plannedMeals")).map((day) => day.position)).toEqual(
      [2],
    ),
  );
});

test("a_day_from_a_library_meal_shows_the_meals_picture", async () => {
  const pictured = { ...aMeal("Fajitas"), imageId: "fajitas-image" };
  await seed(db, {
    meals: [pictured],
    plannedMeals: [
      aPlannedMeal(0, "Fajitas", pictured),
      aPlannedMeal(1, "Takeaway"),
    ],
  });
  renderApp("/plan", db, fakeLoop());

  await waitFor(() =>
    expect(
      [...document.querySelectorAll("img")].map((image) =>
        image.getAttribute("src"),
      ),
    ).toEqual(["/images/fajitas-image/thumb"]),
  );
});

test("a_filled_days_link_is_not_natively_draggable", async () => {
  await seed(db, { plannedMeals: [aPlannedMeal(1, "Curry", curry)] });
  renderApp("/plan", db, fakeLoop());

  expect(await screen.findByRole("link", { name: /Curry/ })).toHaveAttribute(
    "draggable",
    "false",
  );
});

function slotAt(position: number): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-position="${position}"]`,
  );
  if (!element) {
    throw new Error(`No slot at ${position}`);
  }
  return element;
}

test("mid_drag_the_target_says_what_a_drop_does_and_the_dragged_day_shows_the_name_it_would_take", async () => {
  laySlotsOut();
  await seed(db, {
    plannedMeals: [aPlannedMeal(0, "Curry", curry), aPlannedMeal(1, "Fajitas")],
  });
  const { user } = renderApp("/plan", db, fakeLoop());

  (
    await screen.findByRole("button", { name: `Move Curry from ${monday}` })
  ).focus();
  await user.keyboard("[Space]");
  await user.keyboard("[ArrowDown]");

  expect(within(slotAt(1)).getByText("Swap")).toBeInTheDocument();
  expect(
    within(slotAt(1)).queryByRole("button", { name: /^Move Fajitas/ }),
  ).not.toBeInTheDocument();
  expect(within(slotAt(0)).getByRole("link")).toHaveTextContent("Fajitas");

  await user.keyboard("[ArrowDown]");

  expect(within(slotAt(2)).getByText("Move here")).toBeInTheDocument();
  expect(within(slotAt(1)).queryByText("Swap")).not.toBeInTheDocument();
  expect(within(slotAt(0)).getByRole("link")).toHaveTextContent("Curry");

  await user.keyboard("[Escape]");

  expect(screen.queryByText("Move here")).not.toBeInTheDocument();
  expect((await plannedMealsAt(db, 0))[0]).toMatchObject({ name: "Curry" });
});
