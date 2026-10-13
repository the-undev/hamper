import { expect, test } from "vitest";
import { cropFromPercent, largestCentredSquare } from "./crop";

const landscape = { width: 1600, height: 1000 };
const portrait = { width: 900, height: 1200 };

test("the_frame_starts_as_the_largest_square_centred_on_a_landscape_picture", () => {
  expect(cropFromPercent(largestCentredSquare(landscape), landscape)).toEqual({
    x: 300,
    y: 0,
    size: 1000,
  });
});

test("the_frame_starts_as_the_largest_square_centred_on_a_portrait_picture", () => {
  expect(cropFromPercent(largestCentredSquare(portrait), portrait)).toEqual({
    x: 0,
    y: 150,
    size: 900,
  });
});

test("a_percent_frame_converts_to_the_pictures_pixels", () => {
  const frame = { unit: "%", x: 10, y: 20, width: 25, height: 40 } as const;

  expect(cropFromPercent(frame, landscape)).toEqual({
    x: 160,
    y: 200,
    size: 400,
  });
});

test("a_frame_that_strays_past_an_edge_is_kept_inside_the_picture", () => {
  const frame = { unit: "%", x: 80, y: -5, width: 25, height: 40 } as const;

  expect(cropFromPercent(frame, landscape)).toEqual({
    x: 1200,
    y: 0,
    size: 400,
  });
});
