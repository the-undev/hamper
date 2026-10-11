import { expect, test } from "vitest";
import { plannedMealDragSensorOptions } from "./DayList";

test("a_mouse_lifts_a_planned_meal_after_8px_up_or_down_and_swipes_sideways_and_a_finger_lifts_after_a_hold", () => {
  expect(plannedMealDragSensorOptions).toEqual({
    mouse: {
      activationConstraint: { distance: { y: 8 }, tolerance: { x: 8 } },
    },
    touch: { activationConstraint: { delay: 250, tolerance: 8 } },
  });
});
