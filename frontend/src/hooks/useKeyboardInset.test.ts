import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { installVisualViewport } from "@/test/fake-visual-viewport";
import { useKeyboardInset } from "./useKeyboardInset";

let uninstall: () => void = () => {};
const fullHeight = window.innerHeight;

afterEach(() => {
  uninstall();
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: fullHeight,
  });
});

test("without_a_visual_viewport_nothing_is_covered", () => {
  const { result } = renderHook(() => useKeyboardInset());

  expect(result.current).toEqual({ inset: 0, visibleHeight: null });
});

test("a_keyboard_that_shrinks_the_visual_viewport_is_the_inset", async () => {
  const installed = installVisualViewport();
  uninstall = installed.uninstall;
  const { result } = renderHook(() => useKeyboardInset());
  expect(result.current).toEqual({
    inset: 0,
    visibleHeight: window.innerHeight,
  });

  act(() => installed.viewport.moveTo(window.innerHeight - 300, 0));

  await waitFor(() =>
    expect(result.current).toEqual({
      inset: 300,
      visibleHeight: window.innerHeight - 300,
    }),
  );
});

test("a_panned_visual_viewport_counts_only_what_is_below_it", async () => {
  const installed = installVisualViewport();
  uninstall = installed.uninstall;
  const { result } = renderHook(() => useKeyboardInset());

  act(() => installed.viewport.moveTo(window.innerHeight - 400, 100));

  await waitFor(() => expect(result.current.inset).toBe(300));
});

test("a_page_that_shrinks_with_the_keyboard_has_no_inset", async () => {
  const installed = installVisualViewport();
  uninstall = installed.uninstall;
  const { result } = renderHook(() => useKeyboardInset());

  // The browser honours resizes-content: the layout viewport shrinks with the visual one.
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: fullHeight - 300,
  });
  act(() => installed.viewport.moveTo(fullHeight - 300, 0));

  await waitFor(() =>
    expect(result.current).toEqual({
      inset: 0,
      visibleHeight: fullHeight - 300,
    }),
  );
});
