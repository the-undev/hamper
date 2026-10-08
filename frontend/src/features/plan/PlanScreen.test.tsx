import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import { resizeTo } from "@/test/fake-resize-observer";
import { seed, thePlan } from "@/test/rows";

let db: HamperDb;

beforeEach(async () => {
  db = freshDb();
  await seed(db, { plan: [thePlan("2026-06-01", 7)] });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});

function track(): HTMLElement {
  const element = document.querySelector<HTMLElement>("[data-plan-track]");
  if (!element) {
    throw new Error("No plan track");
  }
  return element;
}

function frame(): HTMLElement {
  const element = document.querySelector<HTMLElement>("[data-plan-frame]");
  if (!element) {
    throw new Error("No plan frame");
  }
  return element;
}

function pane(view: "meals" | "items"): HTMLElement {
  const element = document.querySelector<HTMLElement>(
    `[data-plan-view="${view}"]`,
  );
  if (!element) {
    throw new Error(`No ${view} pane`);
  }
  return element;
}

/** Presses on the element, moves sideways by movedX and lets go after the given milliseconds; jsdom is 1024px wide and lays nothing out, so a third is about 341px. */
function swipe(element: HTMLElement, movedX: number, ms: number): void {
  const clock = vi.spyOn(Date, "now").mockReturnValue(10_000);
  fireEvent.pointerDown(element, { clientX: 600, clientY: 300 });
  fireEvent.pointerMove(element, {
    clientX: 600 + Math.sign(movedX) * 20,
    clientY: 302,
  });
  fireEvent.pointerMove(element, { clientX: 600 + movedX, clientY: 305 });
  clock.mockReturnValue(10_000 + ms);
  fireEvent.pointerUp(element, { clientX: 600 + movedX, clientY: 305 });
  clock.mockRestore();
}

test("the_segmented_control_slides_the_track_to_the_chosen_view", async () => {
  const { user } = renderApp("/plan", db, fakeLoop());

  await user.click(await screen.findByRole("radio", { name: "Items" }));
  expect(track().style.transform).toBe("translateX(-50%)");
  expect(track()).toHaveClass("transition-transform");

  await user.click(screen.getByRole("radio", { name: "Meals" }));
  expect(track().style.transform).toBe("");
});

test("the_track_follows_a_sideways_swipe_and_a_swipe_past_a_third_switches_the_view", async () => {
  renderApp("/plan", db, fakeLoop());
  const startLine = await screen.findByText(/^Starts/);

  const clock = vi.spyOn(Date, "now").mockReturnValue(10_000);
  fireEvent.pointerDown(startLine, { clientX: 600, clientY: 300 });
  fireEvent.pointerMove(startLine, { clientX: 580, clientY: 302 });
  fireEvent.pointerMove(startLine, { clientX: 200, clientY: 305 });
  expect(track().style.transform).toBe("translateX(-400px)");
  expect(track()).not.toHaveClass("transition-transform");
  clock.mockReturnValue(11_000);
  fireEvent.pointerUp(startLine, { clientX: 200, clientY: 305 });

  expect(screen.getByRole("radio", { name: "Items" })).toBeChecked();
  expect(track().style.transform).toBe("translateX(-50%)");
  expect(window.localStorage.getItem("hamper.planView")).toBe("items");
});

test("a_short_slow_swipe_snaps_back", async () => {
  renderApp("/plan", db, fakeLoop());

  swipe(await screen.findByText(/^Starts/), -100, 1000);

  expect(screen.getByRole("radio", { name: "Meals" })).toBeChecked();
  expect(track().style.transform).toBe("");
});

test("a_short_fast_swipe_switches_the_view", async () => {
  renderApp("/plan", db, fakeLoop());

  swipe(await screen.findByText(/^Starts/), -100, 50);

  expect(screen.getByRole("radio", { name: "Items" })).toBeChecked();
});

test("a_mostly_vertical_move_scrolls_and_leaves_the_view", async () => {
  renderApp("/plan", db, fakeLoop());
  const startLine = await screen.findByText(/^Starts/);

  fireEvent.pointerDown(startLine, { clientX: 600, clientY: 300 });
  fireEvent.pointerMove(startLine, { clientX: 595, clientY: 330 });
  fireEvent.pointerMove(startLine, { clientX: 200, clientY: 360 });
  fireEvent.pointerUp(startLine, { clientX: 200, clientY: 360 });

  expect(screen.getByRole("radio", { name: "Meals" })).toBeChecked();
  expect(track().style.transform).toBe("");
});

test("the_inactive_view_is_inert", async () => {
  const { user } = renderApp("/plan", db, fakeLoop());
  await screen.findByText(/^Starts/);

  expect(pane("items")).toHaveAttribute("inert");
  expect(pane("items")).toHaveAttribute("aria-hidden", "true");
  expect(pane("meals")).not.toHaveAttribute("inert");
  expect(
    screen.queryByRole("textbox", { name: "Add an item" }),
  ).not.toBeInTheDocument();

  await user.click(screen.getByRole("radio", { name: "Items" }));

  expect(pane("meals")).toHaveAttribute("inert");
  expect(pane("items")).not.toHaveAttribute("inert");
  expect(
    screen.getByRole("textbox", { name: "Add an item" }),
  ).toBeInTheDocument();
});

test("the_frame_is_as_tall_as_the_view_on_show_and_animates_only_on_a_switch", async () => {
  const { user } = renderApp("/plan", db, fakeLoop());
  await screen.findByText(/^Starts/);

  resizeTo(pane("meals"), 480);
  resizeTo(pane("items"), 900);
  expect(frame().style.height).toBe("480px");

  resizeTo(pane("meals"), 520);
  expect(frame().style.height).toBe("520px");
  expect(frame().style.transitionProperty).toBe("none");

  await user.click(screen.getByRole("radio", { name: "Items" }));
  resizeTo(pane("items"), 300);
  expect(frame().style.height).toBe("300px");
  expect(frame().style.transitionProperty).toBe("");
  expect(pane("meals")).toHaveAttribute("inert");

  resizeTo(pane("meals"), 1000);
  expect(frame().style.height).toBe("300px");
});
