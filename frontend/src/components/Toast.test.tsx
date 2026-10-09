import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { showToast, type ToastAction } from "./Toast";
import { Toaster } from "./ui/sonner";

const undo: ToastAction = {
  label: "Undo",
  onAction: () => {},
  closesAfterMs: 5000,
};

/** How long Sonner keeps a closed toast for its exit before removing it. */
const exitMilliseconds = 200;

beforeEach(() => {
  // Sonner closes a dismissed toast on the next animation frame.
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "Date",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  render(<Toaster />);
});

afterEach(() => {
  act(() => vi.runOnlyPendingTimers());
  vi.useRealTimers();
});

/** Moves the fake clock on, inside act so the toaster renders. */
function advance(milliseconds: number): void {
  act(() => vi.advanceTimersByTime(milliseconds));
}

test("an_action_toast_with_a_lifetime_closes_after_it", () => {
  act(() => showToast("Added Milk", undo));
  advance(1);
  expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();

  advance(4998);
  expect(screen.getByText("Added Milk")).toBeInTheDocument();

  advance(1 + exitMilliseconds);
  expect(screen.queryByText("Added Milk")).not.toBeInTheDocument();
});

test("a_toast_without_an_action_closes_after_two_and_a_half_seconds", () => {
  act(() => showToast("Saved"));
  advance(2499);
  expect(screen.getByText("Saved")).toBeInTheDocument();

  advance(1 + exitMilliseconds);
  expect(screen.queryByText("Saved")).not.toBeInTheDocument();
});

test("a_new_toast_replaces_the_one_showing", () => {
  act(() => showToast("Added Milk", undo));
  advance(1);
  act(() => showToast("Added Bread", undo));
  // The old toast is dismissed on the next frame, then leaves after its exit.
  advance(20);
  advance(exitMilliseconds);

  expect(screen.getByText("Added Bread")).toBeInTheDocument();
  expect(screen.queryByText("Added Milk")).not.toBeInTheDocument();
});
