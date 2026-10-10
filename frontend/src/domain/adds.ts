import { liveRow, liveRows } from "@/store/live";
import type { Writer } from "@/store/write";
import { liveWhere } from "./checks";
import { ensureItem } from "./items";
import { setMealLine } from "./meals";
import { setPlannedMealLine } from "./plan";
import { addShopLine } from "./shops";
import { addWanted } from "./wanted";

/** The line tables the type-ahead adds to. */
export type AddedLineTable =
  | "mealLines"
  | "plannedMealLines"
  | "wantedLines"
  | "shopLines";

const addedLineTables: readonly AddedLineTable[] = [
  "mealLines",
  "plannedMealLines",
  "wantedLines",
  "shopLines",
];

/** The line an add wrote, and its count before, null when the add made the line. */
export interface LineAdd {
  lineTable: AddedLineTable;
  lineId: string;
  previousCount: number | null;
}

/** What undoing an add needs: the line it wrote, its count before, and the item it made, null when the item was there already. */
export interface AddReceipt extends LineAdd {
  createdItemId: string | null;
}

/** Puts one of an item on a list. */
export type AddLine = (w: Writer, itemId: string) => Promise<LineAdd>;

/** Builds the LineAdd from the item's line before and after the add. */
function lineAdd(
  lineTable: AddedLineTable,
  previousLine: { count: number } | undefined,
  addedLine: { id: string } | undefined,
): LineAdd {
  if (!addedLine) {
    throw new Error(`The add wrote no ${lineTable} row`);
  }
  return {
    lineTable,
    lineId: addedLine.id,
    previousCount: previousLine?.count ?? null,
  };
}

/** Adds one of an item to a meal. */
export async function addToMeal(
  w: Writer,
  mealId: string,
  itemId: string,
  now: string,
): Promise<LineAdd> {
  const lineOfItem = async () =>
    (await liveWhere(w, "mealLines", "mealId", mealId)).find(
      (line) => line.itemId === itemId,
    );
  const previousLine = await lineOfItem();
  await setMealLine(w, mealId, itemId, (previousLine?.count ?? 0) + 1, now);
  return lineAdd("mealLines", previousLine, await lineOfItem());
}

/** Adds one of an item to a planned meal, for it only. */
export async function addToPlannedMeal(
  w: Writer,
  plannedMealId: string,
  itemId: string,
  now: string,
): Promise<LineAdd> {
  const lineOfItem = async () =>
    (
      await liveWhere(w, "plannedMealLines", "plannedMealId", plannedMealId)
    ).find((line) => line.itemId === itemId);
  const previousLine = await lineOfItem();
  await setPlannedMealLine(
    w,
    plannedMealId,
    itemId,
    (previousLine?.count ?? 0) + 1,
    now,
  );
  return lineAdd("plannedMealLines", previousLine, await lineOfItem());
}

/** Adds one of an item to the extras list. */
export async function addToWanted(w: Writer, itemId: string): Promise<LineAdd> {
  const previousLine = liveRows(await w.all("wantedLines")).find(
    (line) => line.itemId === itemId,
  );
  return lineAdd("wantedLines", previousLine, await addWanted(w, itemId, 1));
}

/** Adds one of an item to a shop. */
export async function addToShop(
  w: Writer,
  shopId: string,
  itemId: string,
  now: string,
): Promise<LineAdd> {
  const previousLine = (await liveWhere(w, "shopLines", "shopId", shopId)).find(
    (line) => line.itemId === itemId,
  );
  return lineAdd(
    "shopLines",
    previousLine,
    await addShopLine(w, shopId, itemId, now),
  );
}

/** Adds a picked item to a list. */
export async function addPicked(
  w: Writer,
  itemId: string,
  addLine: AddLine,
): Promise<AddReceipt> {
  return { ...(await addLine(w, itemId)), createdItemId: null };
}

/** Adds an item to a list by its name, making the item when no live item has the name. */
export async function addNamed(
  w: Writer,
  name: string,
  addLine: AddLine,
): Promise<AddReceipt> {
  const { item, created } = await ensureItem(w, name);
  return {
    ...(await addLine(w, item.id)),
    createdItemId: created ? item.id : null,
  };
}

/** Whether any live meal, planned meal, extras or shop line points at the item. */
async function itemInUse(w: Writer, itemId: string): Promise<boolean> {
  for (const table of addedLineTables) {
    if ((await liveWhere(w, table, "itemId", itemId)).length > 0) {
      return true;
    }
  }
  return false;
}

/** Removes the line an add made, or puts back the count it had; a line removed since is left alone. */
async function takeBackLine(
  w: Writer,
  receipt: AddReceipt,
  now: string,
): Promise<void> {
  const line = liveRow(await w.get(receipt.lineTable, receipt.lineId));
  if (!line) {
    return;
  }
  if (receipt.previousCount === null) {
    await w.tombstone(receipt.lineTable, line.id, now);
    return;
  }
  await w.put(receipt.lineTable, { ...line, count: receipt.previousCount });
}

/** Takes an add back: its line goes or returns to its count, and an item the add made goes too when nothing else uses it. */
export async function undoAdd(
  w: Writer,
  receipt: AddReceipt,
  now: string,
): Promise<void> {
  await takeBackLine(w, receipt, now);
  if (receipt.createdItemId === null) {
    return;
  }
  if (await itemInUse(w, receipt.createdItemId)) {
    return;
  }
  await w.tombstone("items", receipt.createdItemId, now);
}
