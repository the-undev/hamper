import { expect, test } from "vitest";
import { daySwapSensorOptions } from "./DayList";

test("a_mouse_lifts_a_day_at_once_and_a_finger_after_a_hold", () => {
  expect(daySwapSensorOptions).toEqual({
    mouse: { activationConstraint: { distance: 8 } },
    touch: { activationConstraint: { delay: 250, tolerance: 8 } },
  });
});
