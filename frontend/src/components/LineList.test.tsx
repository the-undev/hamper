import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { LineList, type LineView } from "./LineList";

const lines: LineView[] = [
  { id: "l1", itemId: "i1", name: "Bread", size: null, count: 1 },
  { id: "l2", itemId: "i2", name: "Milk", size: "2 pints", count: 1 },
];

function rowOf(name: string): HTMLElement {
  const row = screen
    .getAllByRole("listitem")
    .find((item) => item.textContent?.startsWith(name));
  if (!row) {
    throw new Error(`No row for ${name}`);
  }
  return row;
}

function renderLines(): void {
  render(
    <LineList
      lines={lines}
      empty="Nothing here"
      onCount={() => {}}
      onRemove={() => {}}
    />,
  );
}

test("a_line_without_a_size_renders_no_size_element", () => {
  renderLines();

  expect(rowOf("Bread").querySelector("small")).toBeNull();
});

test("a_line_with_a_size_renders_it_under_the_name", () => {
  renderLines();

  expect(rowOf("Milk").querySelector("small")).toHaveTextContent("2 pints");
});
