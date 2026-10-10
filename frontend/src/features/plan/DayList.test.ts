import { expect, test } from "vitest";
import { plannedMealDragSensorOptions } from "./DayList";

test("a_mouse_lifts_a_planned_meal_after_8px_and_a_finger_after_a_hold", () => {
  expect(plannedMealDragSensorOptions).toEqual({
    mouse: { activationConstraint: { distance: 8 } },
    touch: { activationConstraint: { delay: 250, tolerance: 8 } },
  });
});
