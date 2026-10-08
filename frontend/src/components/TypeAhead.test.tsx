import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { rankOptions, TypeAhead, type TypeAheadOption } from "./TypeAhead";

const option = (name: string): TypeAheadOption => ({
  id: name,
  name,
  detail: null,
});

const options = [
  option("Oat milk"),
  option("Milk chocolate"),
  option("Milk"),
  option("Rice"),
];

function renderTypeAhead() {
  const onPick = vi.fn();
  const onCreate = vi.fn();
  render(
    <TypeAhead
      label="Add an item"
      placeholder="Add an item…"
      options={options}
      onPick={onPick}
      create={{ label: (name) => `Add “${name}”`, onCreate }}
    />,
  );
  return { onPick, onCreate, input: screen.getByLabelText("Add an item") };
}

test("ranking_puts_the_exact_name_then_prefixes_then_substrings_ignoring_case", () => {
  expect(rankOptions(options, "MILK").map((ranked) => ranked.name)).toEqual([
    "Milk",
    "Milk chocolate",
    "Oat milk",
  ]);
});

test("matches_come_first_prefixes_before_substrings_and_the_create_row_last", async () => {
  const user = userEvent.setup();
  const { input } = renderTypeAhead();

  await user.type(input, "mil");

  const rowNames = screen
    .getAllByRole("button")
    .map((row) => row.textContent?.trim());
  expect(rowNames).toEqual(["Milk chocolate", "Milk", "Oat milk", "Add “mil”"]);
});

test("enter_picks_the_first_row_which_is_the_exact_match_when_there_is_one", async () => {
  const user = userEvent.setup();
  const { input, onPick, onCreate } = renderTypeAhead();

  await user.type(input, "milk{Enter}");

  expect(onPick).toHaveBeenCalledWith(options[2]);
  expect(onCreate).not.toHaveBeenCalled();
  expect(input).toHaveValue("");
});

test("enter_picks_the_best_match_when_one_exists", async () => {
  const user = userEvent.setup();
  const { input, onPick, onCreate } = renderTypeAhead();

  await user.type(input, "ric{Enter}");

  expect(onPick).toHaveBeenCalledWith(options[3]);
  expect(onCreate).not.toHaveBeenCalled();
});

test("enter_creates_when_nothing_matches", async () => {
  const user = userEvent.setup();
  const { input, onPick, onCreate } = renderTypeAhead();

  await user.type(input, "  Bread ");
  const rowNames = screen
    .getAllByRole("button")
    .map((row) => row.textContent?.trim());
  await user.keyboard("{Enter}");

  expect(rowNames).toEqual(["Add “Bread”"]);
  expect(onCreate).toHaveBeenCalledWith("Bread");
  expect(onPick).not.toHaveBeenCalled();
});

test("tapping_a_match_picks_it", async () => {
  const user = userEvent.setup();
  const { input, onPick } = renderTypeAhead();

  await user.type(input, "ric");
  await user.click(screen.getByRole("button", { name: "Rice" }));

  expect(onPick).toHaveBeenCalledWith(options[3]);
});

test("without_a_create_the_first_row_is_the_best_match", async () => {
  const user = userEvent.setup();
  const onPick = vi.fn();
  render(
    <TypeAhead
      label="Merge into"
      placeholder="Another item…"
      options={options}
      onPick={onPick}
    />,
  );

  await user.type(screen.getByLabelText("Merge into"), "oat{Enter}");

  expect(onPick).toHaveBeenCalledWith(options[0]);
});
