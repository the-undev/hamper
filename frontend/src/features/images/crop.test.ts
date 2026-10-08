import { expect, test } from "vitest";
import { clampCrop, cropPlacement, initialCrop } from "./crop";

const landscape = { width: 1600, height: 1000 };

test("at_zoom_one_a_landscape_picture_covers_the_box_by_its_height_and_is_centred", () => {
  expect(cropPlacement(initialCrop, landscape, 1200)).toEqual({
    x: -360,
    y: 0,
    width: 1920,
    height: 1200,
  });
});

test("the_pan_stops_where_the_picture_would_leave_part_of_the_box_empty", () => {
  const clamped = clampCrop({ zoom: 1, offsetX: 1, offsetY: 1 }, landscape);

  expect(clamped.offsetX).toBeCloseTo(0.3);
  expect(clamped.offsetY).toBe(0);
});

test("the_zoom_stays_between_one_and_three", () => {
  expect(clampCrop({ zoom: 5, offsetX: 0, offsetY: 0 }, landscape).zoom).toBe(
    3,
  );
  expect(clampCrop({ zoom: 0.5, offsetX: 0, offsetY: 0 }, landscape).zoom).toBe(
    1,
  );
});
