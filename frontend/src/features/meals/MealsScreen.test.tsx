import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
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
  await db.delete();
});

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
