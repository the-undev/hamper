import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { write } from "@/store/write";
import { freshDb } from "@/test/db";
import { anItem, aWantedLine, live, now, seed } from "@/test/rows";
import { addWanted, removeWanted, setWantedWeekly } from "./wanted";

let db: HamperDb;

beforeEach(() => {
  db = freshDb();
});

afterEach(async () => {
  await db.delete();
});

test("adding_an_item_to_the_extras_list_makes_a_once_line", async () => {
  const milk = anItem("Milk");
  await seed(db, { items: [milk] });

  await write(db, (w) => addWanted(w, milk.id, 1));

  expect(await live(db, "wantedLines")).toMatchObject([
    { itemId: milk.id, count: 1, weekly: false },
  ]);
});

test("adding_an_item_already_on_the_extras_list_adds_to_its_count", async () => {
  const milk = anItem("Milk");
  await seed(db, { items: [milk], wantedLines: [aWantedLine(milk, 2, true)] });

  await write(db, (w) => addWanted(w, milk.id, 1));

  expect(await live(db, "wantedLines")).toMatchObject([
    { itemId: milk.id, count: 3, weekly: true },
  ]);
});

test("each_extras_line_is_marked_once_or_weekly", async () => {
  const milk = anItem("Milk");
  const line = aWantedLine(milk, 1);
  await seed(db, { items: [milk], wantedLines: [line] });

  await write(db, (w) => setWantedWeekly(w, line.id, true));
  expect((await db.wantedLines.get(line.id))?.weekly).toBe(true);

  await write(db, (w) => setWantedWeekly(w, line.id, false));
  expect((await db.wantedLines.get(line.id))?.weekly).toBe(false);
});

test("an_extras_line_is_removed", async () => {
  const milk = anItem("Milk");
  const line = aWantedLine(milk, 1);
  await seed(db, { items: [milk], wantedLines: [line] });

  await write(db, (w) => removeWanted(w, line.id, now));
  expect(await live(db, "wantedLines")).toEqual([]);
});
