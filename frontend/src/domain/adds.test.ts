import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { write } from "@/store/write";
import { freshDb } from "@/test/db";
import { aMeal, anItem, aWantedLine, live, now, seed } from "@/test/rows";
import { addNamed, addPicked, addToMeal, addToWanted, undoAdd } from "./adds";

let db: HamperDb;

beforeEach(() => {
  db = freshDb();
});

afterEach(async () => {
  await db.delete();
});

test("undo_removes_the_line_and_a_freshly_created_unused_item", async () => {
  const receipt = await write(db, (w) => addNamed(w, "Banana", addToWanted));
  expect(await live(db, "wantedLines")).toHaveLength(1);

  await write(db, (w) => undoAdd(w, receipt, now));

  expect(await live(db, "wantedLines")).toEqual([]);
  expect(await live(db, "items")).toEqual([]);
});

test("undo_keeps_an_item_used_elsewhere", async () => {
  const curry = aMeal("Curry");
  await seed(db, { meals: [curry] });
  const receipt = await write(db, (w) =>
    addNamed(w, "Coriander", (w, itemId) =>
      addToMeal(w, curry.id, itemId, now),
    ),
  );
  await write(db, (w) => addToWanted(w, receipt.createdItemId ?? ""));

  await write(db, (w) => undoAdd(w, receipt, now));

  expect(await live(db, "mealLines")).toEqual([]);
  expect((await live(db, "items")).map((item) => item.name)).toEqual([
    "Coriander",
  ]);
  expect(await live(db, "wantedLines")).toHaveLength(1);
});

test("undo_restores_the_previous_count_when_the_add_grew_a_line", async () => {
  const milk = anItem("Milk");
  const milkLine = aWantedLine(milk, 2);
  await seed(db, { items: [milk], wantedLines: [milkLine] });
  const receipt = await write(db, (w) => addPicked(w, milk.id, addToWanted));
  expect(receipt).toEqual({
    lineTable: "wantedLines",
    lineId: milkLine.id,
    previousCount: 2,
    createdItemId: null,
  });

  await write(db, (w) => undoAdd(w, receipt, now));

  expect(await live(db, "wantedLines")).toMatchObject([
    { id: milkLine.id, count: 2 },
  ]);
  expect(await live(db, "items")).toHaveLength(1);
});
