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

test("swiping_a_meal_reveals_remove_which_removes_only_that_meal", async () => {
  const curryDinner = aPlannedMeal(0, "Curry", curry);
  const pudding = aPlannedMeal(0, "Pudding", null, 1);
  await seed(db, {
    plannedMeals: [curryDinner, pudding],
    plannedMealLines: [aPlannedMealLine(curryDinner, rice, 1)],
  });
  const { user } = renderApp("/plan", db, fakeLoop());

  await user.click(
    await screen.findByRole("button", { name: `Remove Curry from ${monday}` }),
  );

  await waitFor(() =>
    expect(
      screen.queryByRole("link", { name: /^Curry/ }),
    ).not.toBeInTheDocument(),
  );
  expect(await plannedMealsAt(db, 0)).toMatchObject([
    { id: pudding.id, rank: 0 },
  ]);
  expect(await dayLinesAt(0)).toEqual([]);
});

test("each_day_is_a_card_of_its_meals_in_order_with_add_a_meal_and_a_count_past_one", async () => {
  const curryDinner = aPlannedMeal(0, "Curry", curry, 0);
  await seed(db, {
    plannedMeals: [aPlannedMeal(0, "Pudding", null, 1), curryDinner],
    plannedMealLines: [
      aPlannedMealLine(curryDinner, rice, 1),
      aPlannedMealLine(curryDinner, naan, 2),
    ],
  });
  renderApp("/plan", db, fakeLoop());

  const mondayCard = await screen.findByRole("listitem", { name: monday });
  await waitFor(() =>
    expect(
      within(mondayCard)
        .getAllByRole("link")
        .map((link) => link.getAttribute("aria-label") ?? link.textContent),
    ).toEqual([
      "CurryNaan, Rice",
      "Pudding" + "nothing to buy",
      `Add a meal to ${monday}`,
    ]),
  );
  expect(within(mondayCard).getByText("2 meals")).toBeInTheDocument();
  const tuesdayCard = screen.getByRole("listitem", { name: tuesday });
  expect(
    within(tuesdayCard)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["+ Add a meal"]);
  expect(within(tuesdayCard).queryByText(/meals$/)).not.toBeInTheDocument();
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

/** jsdom lays nothing out, so each day's card is 400px tall from its position, with a 36px header and then 62px rows; the drag overlay sits where its fixed style puts it. */
function layDaysOut(): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const overlay = this.closest<HTMLElement>("[style*='position: fixed']");
      if (overlay) {
        const { left, top, width, height } = overlay.style;
        return new DOMRect(
          Number.parseFloat(left),
          Number.parseFloat(top),
          Number.parseFloat(width),
          Number.parseFloat(height),
        );
      }
      const card = this.closest("[data-position]");
      const cardTop = Number(card?.getAttribute("data-position") ?? 0) * 400;
      const row = this.closest("[data-row-index]");
      if (!row) {
        return new DOMRect(0, cardTop, 360, 392);
      }
      const rowIndex = Number(row.getAttribute("data-row-index"));
      return new DOMRect(0, cardTop + 36 + rowIndex * 62, 360, 62);
    },
  );
}

/** Lifts a planned meal by its Move button, presses the arrow keys, and returns the user to drop or cancel it. */
async function liftAndMove(
  name: string,
  dayLabel: string,
  keys: readonly ("[ArrowDown]" | "[ArrowUp]")[],
) {
  const { user } = renderApp("/plan", db, fakeLoop());
  (
    await screen.findByRole("button", { name: `Move ${name} from ${dayLabel}` })
  ).focus();
  await user.keyboard("[Space]");
  for (const key of keys) {
    await user.keyboard(key);
  }
  return user;
}

async function namesAt(position: number): Promise<string[]> {
  return (await plannedMealsAt(db, position)).map(
    (plannedMeal) => plannedMeal.name,
  );
}

test("moving_a_meal_down_its_day_with_the_keyboard_reorders_the_day", async () => {
  layDaysOut();
  await seed(db, {
    plannedMeals: [
      aPlannedMeal(0, "Curry", curry, 0),
      aPlannedMeal(0, "Soup", null, 1),
      aPlannedMeal(0, "Pudding", null, 2),
    ],
  });
  const user = await liftAndMove("Curry", monday, ["[ArrowDown]"]);

  await user.keyboard("[Space]");

  await waitFor(async () =>
    expect(await namesAt(0)).toEqual(["Soup", "Curry", "Pudding"]),
  );
  expect((await plannedMealsAt(db, 0)).map((meal) => meal.rank)).toEqual([
    0, 1, 2,
  ]);
});

test("moving_a_meal_to_another_day_with_the_keyboard_lands_it_between_the_meals_there", async () => {
  layDaysOut();
  const curryDinner = aPlannedMeal(0, "Curry", curry, 0);
  await seed(db, {
    plannedMeals: [
      curryDinner,
      aPlannedMeal(0, "Soup", null, 1),
      aPlannedMeal(1, "Roast", null, 0),
    ],
    plannedMealLines: [aPlannedMealLine(curryDinner, rice, 1)],
  });
  const user = await liftAndMove("Curry", monday, [
    "[ArrowDown]",
    "[ArrowDown]",
    "[ArrowDown]",
  ]);

  const dropLine = slotAt(1).querySelector("[data-drop-line]");
  expect(dropLine?.nextElementSibling).toHaveTextContent("Roast");
  await user.keyboard("[Space]");

  await waitFor(async () =>
    expect(await namesAt(1)).toEqual(["Curry", "Roast"]),
  );
  expect(await namesAt(0)).toEqual(["Soup"]);
  expect((await plannedMealsAt(db, 0))[0]?.rank).toBe(0);
  expect((await dayLinesAt(1)).map((line) => line.itemId)).toEqual([rice.id]);
  expect(
    await screen.findByRole("button", { name: `Move Curry from ${tuesday}` }),
  ).toBeInTheDocument();
});

test("moving_a_meal_onto_an_empty_days_add_a_meal_row_moves_it_there", async () => {
  layDaysOut();
  await seed(db, { plannedMeals: [aPlannedMeal(0, "Curry", curry)] });
  const user = await liftAndMove("Curry", monday, [
    "[ArrowDown]",
    "[ArrowDown]",
  ]);

  expect(slotAt(1).querySelector("[data-drop-line]")).not.toBeNull();
  await user.keyboard("[Space]");

  await waitFor(async () => expect(await namesAt(1)).toEqual(["Curry"]));
  expect(await namesAt(0)).toEqual([]);
});

test("escape_puts_a_lifted_meal_back_and_clears_the_line", async () => {
  layDaysOut();
  await seed(db, {
    plannedMeals: [aPlannedMeal(0, "Curry", curry), aPlannedMeal(1, "Roast")],
  });
  const user = await liftAndMove("Curry", monday, [
    "[ArrowDown]",
    "[ArrowDown]",
  ]);
  expect(document.querySelector("[data-drop-line]")).not.toBeNull();

  await user.keyboard("[Escape]");

  expect(document.querySelector("[data-drop-line]")).toBeNull();
  expect(await namesAt(0)).toEqual(["Curry"]);
  expect(await namesAt(1)).toEqual(["Roast"]);
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
