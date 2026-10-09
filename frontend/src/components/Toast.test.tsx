import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { type ToastAction, ToastProvider, useToast } from "./Toast";

const undo: ToastAction = {
  label: "Undo",
  onAction: () => {},
  closesAfterMs: 5000,
};

function ShowOnMount() {
  const showToast = useToast();
  useEffect(() => showToast("Added Milk", undo), [showToast]);
  return null;
}

afterEach(() => {
  vi.useRealTimers();
});

test("an_action_toast_with_a_lifetime_closes_after_it", () => {
  vi.useFakeTimers();
  render(
    <ToastProvider>
      <ShowOnMount />
    </ToastProvider>,
  );
  expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();

  act(() => vi.advanceTimersByTime(4999));
  expect(screen.getByText("Added Milk")).toBeInTheDocument();

  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByText("Added Milk")).not.toBeInTheDocument();
});
