import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";

let db: HamperDb;

beforeEach(() => {
  db = freshDb();
});

afterEach(async () => {
  await db.delete();
});

test("the_root_redirects_to_the_plan", async () => {
  const { router } = renderApp("/", db, fakeLoop());

  expect(
    await screen.findByRole("heading", { level: 1, name: "Plan" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/plan");
});

test("the_tab_bar_links_the_four_screens_and_marks_the_current_one", async () => {
  const { user } = renderApp("/plan", db, fakeLoop());
  const tabs = await screen.findByRole("navigation", { name: "Tabs" });

  expect(
    within(tabs)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["▤Plan", "✓Shop", "◍Meals", "⋯More"]);

  await user.click(within(tabs).getByRole("link", { name: "Meals" }));

  expect(
    await screen.findByRole("heading", { level: 1, name: "Meals" }),
  ).toBeInTheDocument();
  expect(within(tabs).getByRole("link", { name: "Meals" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
