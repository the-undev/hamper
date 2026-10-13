import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { pictureSizes } from "@/components/Thumb";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import { aMeal, aMealLine, anItem, live, now, seed } from "@/test/rows";

let db: HamperDb;

const rice = anItem("Rice");
const curry = aMeal("Curry");
const fajitas = aMeal("Fajitas");

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [rice],
    meals: [curry, fajitas, { ...aMeal("Gone"), deletedAt: now }],
    mealLines: [aMealLine(curry, rice, 1)],
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});

const smallGrid = "grid-cols-[repeat(auto-fill,minmax(96px,1fr))]";

/** Waits until the library shows both live meals and returns their links. */
async function mealLinks(): Promise<HTMLElement[]> {
  const library = await screen.findByRole("list");
  return waitFor(() => {
    const links = within(library).getAllByRole("link");
    expect(links).toHaveLength(2);
    return links;
  });
}

/** Whether a view's button in the control is the chosen one. */
function viewChecked(label: string): string | null {
  return within(screen.getByRole("radiogroup", { name: "Show meals as" }))
    .getByRole("radio", { name: label })
    .getAttribute("aria-checked");
}

test("the_grid_lists_the_live_meals_and_the_search_filters_it", async () => {
  const { user } = renderApp("/meals", db, fakeLoop());

  const grid = await screen.findByRole("list");
  await waitFor(() =>
    expect(
      within(grid)
        .getAllByRole("link")
        .map((card) => card.textContent),
    ).toEqual(["CCurry1 items", "FFajitas0 items"]),
  );

  await user.type(screen.getByLabelText("Search or add a meal"), "faj");

  expect(within(grid).getAllByRole("link")).toHaveLength(1);
  expect(
    within(grid).getByRole("link", { name: /Fajitas/ }),
  ).toBeInTheDocument();
});

test("a_name_matching_no_meal_is_added_as_a_new_meal_and_opened", async () => {
  const { user, router } = renderApp("/meals", db, fakeLoop());

  await user.type(
    await screen.findByLabelText("Search or add a meal"),
    "Pasta bake",
  );
  await user.click(
    screen.getByRole("button", { name: "Add “Pasta bake” as a new meal" }),
  );

  const pastaBake = await waitFor(async () => {
    const meal = (await live(db, "meals")).find(
      (row) => row.name === "Pasta bake",
    );
    expect(meal).toBeDefined();
    return meal;
  });
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(`/meals/${pastaBake?.id}`),
  );
  expect(await screen.findByLabelText("Name")).toHaveValue("Pasta bake");
});

test("enter_adds_a_new_meal_or_opens_the_one_named", async () => {
  const { user, router } = renderApp("/meals", db, fakeLoop());

  await user.type(
    await screen.findByLabelText("Search or add a meal"),
    "curry{Enter}",
  );

  await waitFor(() =>
    expect(router.state.location.pathname).toBe(`/meals/${curry.id}`),
  );
  expect(await live(db, "meals")).toHaveLength(2);
});

test("a_card_shows_the_meals_picture", async () => {
  await db.meals.update(curry.id, { imageId: "curry-image" });
  renderApp("/meals", db, fakeLoop());

  await waitFor(() =>
    expect(
      [...document.querySelectorAll("img")].map((image) =>
        image.getAttribute("src"),
      ),
    ).toEqual(["/images/curry-image/thumb"]),
  );
});

test("the_meals_show_as_the_small_grid_by_default", async () => {
  renderApp("/meals", db, fakeLoop());

  const cards = await mealLinks();

  expect(screen.getByRole("list")).toHaveClass(smallGrid);
  for (const card of cards) {
    expect(card.firstElementChild).toHaveClass(...pictureSizes.card.split(" "));
  }
  expect(viewChecked("Small grid")).toBe("true");
  expect(viewChecked("List")).toBe("false");
});

test("choosing_list_shows_each_meal_as_a_row_and_keeps_the_choice", async () => {
  const { user } = renderApp("/meals", db, fakeLoop());
  await mealLinks();

  await user.click(screen.getByRole("radio", { name: "List" }));

  const rows = await mealLinks();
  expect(rows.map((row) => row.textContent)).toEqual([
    "CCurry1 items",
    "FFajitas0 items",
  ]);
  for (const row of rows) {
    expect(row.firstElementChild).toHaveClass(...pictureSizes.row.split(" "));
  }
  expect(screen.getByRole("list")).not.toHaveClass(smallGrid);
  expect(viewChecked("List")).toBe("true");
  expect(viewChecked("Small grid")).toBe("false");
  expect(window.localStorage.getItem("hamper.mealsView")).toBe("list");
});

test("choosing_large_grid_widens_the_cards_and_keeps_the_choice", async () => {
  const { user } = renderApp("/meals", db, fakeLoop());
  await mealLinks();

  await user.click(screen.getByRole("radio", { name: "Large grid" }));

  const cards = await mealLinks();
  expect(screen.getByRole("list")).toHaveClass(
    "grid-cols-[repeat(auto-fill,minmax(150px,1fr))]",
  );
  expect(screen.getByRole("list")).not.toHaveClass(smallGrid);
  for (const card of cards) {
    expect(card.firstElementChild).toHaveClass(...pictureSizes.card.split(" "));
  }
  expect(viewChecked("Large grid")).toBe("true");
  expect(viewChecked("Small grid")).toBe("false");
  expect(window.localStorage.getItem("hamper.mealsView")).toBe("large");
});

test("a_list_chosen_before_shows_on_opening", async () => {
  window.localStorage.setItem("hamper.mealsView", "list");
  renderApp("/meals", db, fakeLoop());

  const rows = await mealLinks();

  for (const row of rows) {
    expect(row.firstElementChild).toHaveClass(...pictureSizes.row.split(" "));
  }
  expect(viewChecked("List")).toBe("true");
});

test("a_phone_that_blocks_storage_gets_the_small_grid_and_can_still_choose", async () => {
  const blocked = (): never => {
    throw new DOMException("Storage is blocked", "SecurityError");
  };
  vi.spyOn(window.localStorage, "getItem").mockImplementation(blocked);
  vi.spyOn(window.localStorage, "setItem").mockImplementation(blocked);
  const { user } = renderApp("/meals", db, fakeLoop());

  await mealLinks();
  expect(screen.getByRole("list")).toHaveClass(smallGrid);

  await user.click(screen.getByRole("radio", { name: "List" }));

  expect(viewChecked("List")).toBe("true");
});
