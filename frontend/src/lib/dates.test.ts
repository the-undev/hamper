import { expect, test } from "vitest";
import { formatDay, formatTimestampDay } from "./dates";

test("dates_read_the_same_whatever_the_machine_locale", () => {
  expect(formatDay("2026-10-12")).toBe("Mon 12 Oct");
  expect(formatTimestampDay("2026-10-12T12:00:00Z")).toBe("Mon 12 Oct");
});
