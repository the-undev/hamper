import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { write } from "@/store/write";
import { freshDb } from "@/test/db";
import { anItem, aWantedLine, live, now, seed } from "@/test/rows";
import {
  addWanted,
  removeWanted,
  setWantedCount,
  setWantedWeekly,
} from "./wanted";

let db: HamperDb;

beforeEach(() => {
  db = freshDb();
});

afterEach(async () => {
  await db.delete();
});

test("adding_an_item_to_the_wanted_list_makes_a_once_line", async () => {
  const milk = anItem("Milk");
  await seed(db, { items: [milk] });

  await write(db, (w) => addWanted(w, milk.id, 1));

  expect(await live(db, "wantedLines")).toMatchObject([
    { itemId: milk.id, count: 1, weekly: false },
  ]);
});

test("adding_an_item_already_wanted_adds_to_its_count", async () => {
  const milk = anItem("Milk");
  await seed(db, { items: [milk], wantedLines: [aWantedLine(milk, 2, true)] });

  await write(db, (w) => addWanted(w, milk.id, 1));

  expect(await live(db, "wantedLines")).toMatchObject([
    { itemId: milk.id, count: 3, weekly: true },
  ]);
});

test("each_wanted_line_is_marked_once_or_weekly", async () => {
  const milk = anItem("Milk");
  const line = aWantedLine(milk, 1);
  await seed(db, { items: [milk], wantedLines: [line] });

  await write(db, (w) => setWantedWeekly(w, line.id, true));
  expect((await db.wantedLines.get(line.id))?.weekly).toBe(true);

  await write(db, (w) => setWantedWeekly(w, line.id, false));
  expect((await db.wantedLines.get(line.id))?.weekly).toBe(false);
});

test("a_wanted_lines_count_is_set_and_the_line_removed", async () => {
  const milk = anItem("Milk");
  const line = aWantedLine(milk, 1);
  await seed(db, { items: [milk], wantedLines: [line] });

  await write(db, (w) => setWantedCount(w, line.id, 4));
  expect((await db.wantedLines.get(line.id))?.count).toBe(4);
  await expect(
    write(db, (w) => setWantedCount(w, line.id, 0)),
  ).rejects.toThrow();

  await write(db, (w) => removeWanted(w, line.id, now));
  expect(await live(db, "wantedLines")).toEqual([]);
});
