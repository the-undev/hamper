import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { SwipeRow } from "./SwipeRow";
import { Checkbox } from "./ui/checkbox";

function renderRow() {
  const onRemove = vi.fn();
  const onToWanted = vi.fn();
  const onOpen = vi.fn();
  render(
    <SwipeRow
      subject="Milk"
      actions={[
        { label: "To wanted", tone: "accent", onAction: onToWanted },
        { label: "Remove", tone: "danger", onAction: onRemove },
      ]}
    >
      <button type="button" onClick={onOpen}>
        Milk
      </button>
    </SwipeRow>,
  );
  return { onRemove, onToWanted, onOpen };
}

test("the_actions_are_buttons_named_for_the_row", async () => {
  const user = userEvent.setup();
  const { onRemove, onToWanted } = renderRow();

  await user.click(screen.getByRole("button", { name: "To wanted Milk" }));
  await user.click(screen.getByRole("button", { name: "Remove Milk" }));

  expect(onToWanted).toHaveBeenCalledTimes(1);
  expect(onRemove).toHaveBeenCalledTimes(1);
});

test("a_keyboard_reaches_the_actions_and_focus_slides_the_row_open", async () => {
  const user = userEvent.setup();
  renderRow();
  const front = screen.getByRole("button", { name: "Milk" }).parentElement;

  await user.tab();
  await user.tab();

  expect(screen.getByRole("button", { name: "To wanted Milk" })).toHaveFocus();
  expect(front?.style.transform).toMatch(/translateX\(-/);
});

test("a_swipe_left_opens_the_row_and_does_not_count_as_a_tap", () => {
  const { onOpen } = renderRow();
  const name = screen.getByRole("button", { name: "Milk" });
  const front = name.parentElement;

  fireEvent.pointerDown(name, { clientX: 200, clientY: 10, pointerId: 1 });
  fireEvent.pointerMove(name, { clientX: 150, clientY: 12, pointerId: 1 });
  fireEvent.pointerMove(name, { clientX: 60, clientY: 12, pointerId: 1 });
  fireEvent.pointerUp(name, { clientX: 60, clientY: 12, pointerId: 1 });
  fireEvent.click(name);

  expect(front?.style.transform).toBe("translateX(-96px)");
  expect(onOpen).not.toHaveBeenCalled();
});

test("the_sliding_element_does_not_select_text_under_a_mouse_swipe", () => {
  renderRow();

  expect(
    screen.getByRole("button", { name: "Milk" }).parentElement,
  ).toHaveClass("select-none");
});

test("the_wrapper_clips_to_the_rows_rounding", () => {
  render(
    <SwipeRow subject="Milk" actions={[]} rounded="rounded-[14px]">
      <button type="button">Milk</button>
    </SwipeRow>,
  );
  const front = screen.getByRole("button", { name: "Milk" }).parentElement;

  expect(front).toHaveClass("rounded-[14px]");
  expect(front?.parentElement).toHaveClass("rounded-[14px]", "overflow-hidden");
});

test("a_press_on_a_tick_box_does_not_start_a_swipe", () => {
  render(
    <SwipeRow
      subject="Milk"
      actions={[{ label: "Remove", tone: "danger", onAction: vi.fn() }]}
    >
      <Checkbox aria-label="Milk in the trolley" />
    </SwipeRow>,
  );
  const tickBox = screen.getByRole("checkbox", { name: "Milk in the trolley" });
  const front = tickBox.parentElement;

  fireEvent.pointerDown(tickBox, { clientX: 200, clientY: 10, pointerId: 1 });
  fireEvent.pointerMove(tickBox, { clientX: 60, clientY: 12, pointerId: 1 });
  fireEvent.pointerUp(tickBox, { clientX: 60, clientY: 12, pointerId: 1 });

  expect(front?.style.transform).toBe("");
});
