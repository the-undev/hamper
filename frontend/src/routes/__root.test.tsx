import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop, quietStatus } from "@/test/fake-loop";

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

test("the_header_holds_the_sync_indicator_after_the_screen_actions", async () => {
  const loop = fakeLoop(quietStatus);
  renderApp("/more", db, loop);
  await screen.findByRole("heading", { level: 1, name: "More" });
  const header = screen.getByRole("banner");
  expect(within(header).getByRole("status")).toBe(header.lastElementChild);

  act(() => loop.setStatus({ ...quietStatus, pending: 3 }));

  expect(
    within(header).getByRole("status", { name: "3 changes to send" }),
  ).toBeInTheDocument();
});

test("an_update_shows_a_toast_whose_reload_switches_to_the_new_version", async () => {
  const { appUpdate, user } = renderApp("/more", db, fakeLoop());
  await screen.findByRole("heading", { level: 1, name: "More" });
  expect(screen.queryByText("Update ready")).not.toBeInTheDocument();

  act(() => appUpdate.makeReady());
  expect(screen.getByText("Update ready")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Reload" }));
  expect(appUpdate.reload).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Update ready")).not.toBeInTheDocument();
});
