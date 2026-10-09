import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { installVisualViewport } from "@/test/fake-visual-viewport";
import { BottomSheet } from "./BottomSheet";
import { SheetDescription, SheetTitle } from "./ui/sheet";

let uninstall: () => void = () => {};

afterEach(() => {
  uninstall();
  vi.restoreAllMocks();
});

function renderSheet() {
  return render(
    <BottomSheet open onClose={() => {}}>
      <SheetTitle>Milk</SheetTitle>
      <SheetDescription>Changes here are for this list only.</SheetDescription>
      <input aria-label="Name" />
    </BottomSheet>,
  );
}

test("with_no_keyboard_the_sheet_sits_on_the_bottom_edge", async () => {
  const installed = installVisualViewport();
  uninstall = installed.uninstall;
  renderSheet();

  const sheet = await screen.findByRole("dialog");

  expect(sheet.style.bottom).toBe("0px");
  expect(sheet.style.maxHeight).toBe(`min(85dvh, ${window.innerHeight}px)`);
});

test("the_sheet_lifts_above_the_keyboard_and_fits_what_is_left_visible", async () => {
  const installed = installVisualViewport();
  uninstall = installed.uninstall;
  renderSheet();
  const sheet = await screen.findByRole("dialog");
  const visibleHeight = window.innerHeight - 300;

  act(() => installed.viewport.moveTo(visibleHeight, 0));

  await waitFor(() => expect(sheet.style.bottom).toBe("300px"));
  expect(sheet.style.maxHeight).toBe(`min(85dvh, ${visibleHeight}px)`);
});

test("without_a_visual_viewport_the_sheet_keeps_its_css_cap", async () => {
  renderSheet();

  const sheet = await screen.findByRole("dialog");

  expect(sheet.style.bottom).toBe("0px");
  expect(sheet.style.maxHeight).toBe("");
});

test("when_the_keyboard_comes_up_the_sheet_scrolls_the_focused_field_to_its_top", async () => {
  const installed = installVisualViewport();
  uninstall = installed.uninstall;
  renderSheet();
  const sheet = await screen.findByRole("dialog");
  const field = screen.getByLabelText("Name");
  // jsdom lays nothing out: the sheet starts at 400px and the field 180px below it.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return new DOMRect(0, this === field ? 580 : 400, 360, 44);
    },
  );
  field.focus();

  act(() => installed.viewport.moveTo(window.innerHeight - 300, 0));

  await waitFor(() => expect(sheet.scrollTop).toBe(180 - 16));
});
