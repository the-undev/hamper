import { render, screen, within } from "@testing-library/react";
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
  option("Banana"),
];

const milk = options[2];
const banana = options[4];

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

function rowNames(): (string | undefined)[] {
  return screen.getAllByRole("option").map((row) => row.textContent?.trim());
}

test("matches_come_first_prefixes_before_substrings_and_the_create_row_last", async () => {
  const user = userEvent.setup();
  const { input } = renderTypeAhead();

  await user.type(input, "mil");

  expect(rowNames()).toEqual([
    "Milk chocolate",
    "Milk",
    "Oat milk",
    "Add “mil”",
  ]);
});

test("enter_creates_a_name_that_is_a_prefix_of_an_existing_one", async () => {
  const user = userEvent.setup();
  const { input, onPick, onCreate } = renderTypeAhead();

  await user.type(input, "banan");
  expect(rowNames()).toEqual(["Banana", "Add “banan”"]);
  await user.keyboard("{Enter}");

  expect(onCreate).toHaveBeenCalledWith("banan");
  expect(onPick).not.toHaveBeenCalled();
  expect(input).toHaveValue("");
});

test("enter_picks_an_exact_match_ignoring_case", async () => {
  const user = userEvent.setup();
  const { input, onPick, onCreate } = renderTypeAhead();

  await user.type(input, " bANANA {Enter}");

  expect(onPick).toHaveBeenCalledWith(banana);
  expect(onCreate).not.toHaveBeenCalled();
  expect(input).toHaveValue("");
});

test("enter_creates_when_nothing_matches", async () => {
  const user = userEvent.setup();
  const { input, onPick, onCreate } = renderTypeAhead();

  await user.type(input, "  Bread ");
  expect(rowNames()).toEqual(["Add “Bread”"]);
  await user.keyboard("{Enter}");

  expect(onCreate).toHaveBeenCalledWith("Bread");
  expect(onPick).not.toHaveBeenCalled();
});

test("arrow_down_then_enter_picks_the_highlighted_match", async () => {
  const user = userEvent.setup();
  const { input, onPick, onCreate } = renderTypeAhead();

  await user.type(input, "mil");
  expect(input).not.toHaveAttribute("aria-activedescendant");
  await user.keyboard("{ArrowDown}{ArrowDown}");

  const highlighted = screen.getByRole("option", { selected: true });
  expect(highlighted).toHaveTextContent("Milk");
  expect(highlighted).not.toHaveTextContent("chocolate");
  expect(input).toHaveAttribute("aria-activedescendant", highlighted.id);
  await user.keyboard("{Enter}");

  expect(onPick).toHaveBeenCalledWith(milk);
  expect(onCreate).not.toHaveBeenCalled();
});

test("the_arrows_wrap_through_the_rows_and_reach_the_create_row", async () => {
  const user = userEvent.setup();
  const { input, onPick, onCreate } = renderTypeAhead();

  await user.type(input, "mil{ArrowUp}");
  expect(screen.getByRole("option", { selected: true })).toHaveTextContent(
    "Add “mil”",
  );
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("option", { selected: true })).toHaveTextContent(
    "Milk chocolate",
  );
  await user.keyboard("{ArrowUp}{Enter}");

  expect(onCreate).toHaveBeenCalledWith("mil");
  expect(onPick).not.toHaveBeenCalled();
});

test("escape_clears_the_highlight_then_the_text", async () => {
  const user = userEvent.setup();
  const { input } = renderTypeAhead();

  await user.type(input, "mil{ArrowDown}{Escape}");
  expect(screen.queryByRole("option", { selected: true })).toBeNull();
  expect(input).not.toHaveAttribute("aria-activedescendant");
  expect(input).toHaveValue("mil");

  await user.keyboard("{Escape}");
  expect(input).toHaveValue("");
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("tab_leaves_without_taking_anything", async () => {
  const user = userEvent.setup();
  const { input, onPick, onCreate } = renderTypeAhead();

  await user.type(input, "mil{ArrowDown}");
  await user.tab();

  expect(input).not.toHaveFocus();
  expect(input).toHaveValue("mil");
  expect(onPick).not.toHaveBeenCalled();
  expect(onCreate).not.toHaveBeenCalled();
});

test("tapping_a_match_picks_it", async () => {
  const user = userEvent.setup();
  const { input, onPick } = renderTypeAhead();

  await user.type(input, "ric");
  await user.click(
    within(screen.getByRole("listbox")).getByRole("option", { name: "Rice" }),
  );

  expect(onPick).toHaveBeenCalledWith(options[3]);
});

test("without_a_create_enter_takes_only_an_exact_match_or_the_highlight", async () => {
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
  const input = screen.getByLabelText("Merge into");

  await user.type(input, "oat{Enter}");
  expect(onPick).not.toHaveBeenCalled();

  await user.keyboard("{ArrowDown}{Enter}");
  expect(onPick).toHaveBeenCalledWith(options[0]);
});
