import { expect, test } from "vitest";
import { editDistance, isCloseMatch } from "./distance";

test("a_swap_of_neighbouring_characters_is_one_edit", () => {
  expect(editDistance("banana", "bnaana")).toBe(1);
});

test("an_insertion_is_one_edit", () => {
  expect(editDistance("banana", "bananna")).toBe(1);
});

test("a_deletion_is_one_edit", () => {
  expect(editDistance("banana", "banna")).toBe(1);
});

test("a_substitution_is_one_edit", () => {
  expect(editDistance("banana", "banena")).toBe(1);
});

test("edits_add_up", () => {
  expect(editDistance("banana", "panama")).toBe(2);
  expect(editDistance("banana", "pajama")).toBe(3);
  expect(editDistance("", "tin")).toBe(3);
});

test("a_close_match_allows_two_edits_ignoring_case", () => {
  expect(isCloseMatch("Banana", "PANAMA")).toBe(true);
  expect(isCloseMatch("Banana", "pajama")).toBe(false);
});

test("typed_text_of_four_characters_or_fewer_allows_one_edit", () => {
  expect(isCloseMatch("Rice", "rcie")).toBe(true);
  expect(isCloseMatch("Rice", "rze")).toBe(false);
  expect(isCloseMatch("Rices", "rze")).toBe(false);
});
