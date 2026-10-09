import { expect, test } from "vitest";
import { anItem, aShop, aShopLine, thePlan } from "@/test/rows";
import { byPlanOrder, dayDate, lineName, lineSize } from "./display";

test("days_take_their_date_from_the_start_date_and_their_position", () => {
  const plan = thePlan("2026-06-29", 7);

  expect(dayDate(plan, 0)).toBe("2026-06-29");
  expect(dayDate(plan, 3)).toBe("2026-07-02");
});

test("a_shop_line_shows_its_items_name_and_size_until_they_are_edited_on_the_line", () => {
  const milk = anItem("Milk", "4 pints");
  const line = aShopLine(aShop("Big shop"), milk, 1);

  expect([lineName(line, milk), lineSize(line, milk)]).toEqual([
    "Milk",
    "4 pints",
  ]);
  const editedLine = {
    ...line,
    nameOverride: "Oat milk",
    sizeOverride: "1 litre",
  };
  expect([lineName(editedLine, milk), lineSize(editedLine, milk)]).toEqual([
    "Oat milk",
    "1 litre",
  ]);
});

test("planned_meals_are_ordered_by_day_then_place_then_id_for_two_placed_at_once", () => {
  const places = [
    { position: 1, rank: 0, id: "a" },
    { position: 0, rank: 1, id: "c" },
    { position: 0, rank: 1, id: "b" },
    { position: 0, rank: 0, id: "d" },
  ];

  expect([...places].sort(byPlanOrder).map((place) => place.id)).toEqual([
    "d",
    "b",
    "c",
    "a",
  ]);
});
