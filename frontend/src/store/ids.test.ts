import { expect, test } from "vitest";
import { dayIdFor, newId } from "./ids";

test("day ids match the server's template for three positions", () => {
  expect(dayIdFor(0)).toBe("da7e0000-0000-4000-8000-000000000000");
  expect(dayIdFor(6)).toBe("da7e0000-0000-4000-8000-000000000006");
  expect(dayIdFor(30)).toBe("da7e0000-0000-4000-8000-00000000001e");
});

test("a negative position has no day id", () => {
  expect(() => dayIdFor(-1)).toThrow(RangeError);
});

test("newId makes a UUID", () => {
  expect(newId()).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});
