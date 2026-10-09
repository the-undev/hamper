import { expect, test } from "vitest";
import { newId } from "./ids";

test("newId makes a UUID", () => {
  expect(newId()).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});
