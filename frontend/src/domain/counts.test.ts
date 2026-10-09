import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { write } from "@/store/write";
import { freshDb } from "@/test/db";
import {
  aMeal,
  aMealLine,
  anItem,
  aPlannedMeal,
  aPlannedMealLine,
  aShop,
  aShopLine,
  aWantedLine,
  seed,
} from "@/test/rows";
import { DomainError } from "./checks";
import { adjustLineCount, type LineTable } from "./counts";

let db: HamperDb;

const rice = anItem("Rice");
const curry = aMeal("Curry");
const curryDay = aPlannedMeal(0, "Curry", curry);
const shop = aShop("Corner shop");
const linesByTable = {
  plannedMealLines: aPlannedMealLine(curryDay, rice, 1),
  mealLines: aMealLine(curry, rice, 1),
  wantedLines: aWantedLine(rice, 1),
  shopLines: { ...aShopLine(shop, rice, 1), nameOverride: "Basmati" },
} satisfies Record<LineTable, unknown>;
const lineTables = Object.keys(linesByTable) as LineTable[];

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [rice],
    meals: [curry],
    plannedMeals: [curryDay],
    shops: [shop],
    plannedMealLines: [linesByTable.plannedMealLines],
    mealLines: [linesByTable.mealLines],
    wantedLines: [linesByTable.wantedLines],
    shopLines: [linesByTable.shopLines],
  });
});

afterEach(async () => {
  await db.delete();
});

test.each(lineTables)(
  "two_steps_from_one_shown_count_both_land_on_%s",
  async (table) => {
    const shownLine = linesByTable[table];

    await Promise.all([
      write(db, (w) => adjustLineCount(w, table, shownLine.id, 1)),
      write(db, (w) => adjustLineCount(w, table, shownLine.id, 1)),
    ]);

    expect(await db.table(table).get(shownLine.id)).toEqual({
      ...shownLine,
      count: 3,
    });
    expect(await db.outbox.toArray()).toMatchObject([
      { table, rowId: shownLine.id },
    ]);
  },
);

test.each(lineTables)("a_step_below_1_is_refused_on_%s", async (table) => {
  const shownLine = linesByTable[table];

  await expect(
    write(db, (w) => adjustLineCount(w, table, shownLine.id, -1)),
  ).rejects.toThrow(DomainError);
  expect((await db.table(table).get(shownLine.id))?.count).toBe(1);
});
