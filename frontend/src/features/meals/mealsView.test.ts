import { expect, test } from "vitest";
import { parseMealsView } from "./mealsView";

test("a_stored_view_is_read_back_and_anything_else_is_the_small_grid", () => {
  expect(parseMealsView("list")).toBe("list");
  expect(parseMealsView("small")).toBe("small");
  expect(parseMealsView("large")).toBe("large");
  expect(parseMealsView("tiles")).toBe("small");
  expect(parseMealsView(null)).toBe("small");
});
