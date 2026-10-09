import { newId } from "@/store/ids";
import { liveRows } from "@/store/live";
import type { Item, TableRows } from "@/store/types";
import type { Writer } from "@/store/write";
import {
  liveWhere,
  nameMaxLength,
  optionalText,
  requireLive,
  requireName,
  sizeMaxLength,
} from "./checks";

/** An item found or made by name, and whether it was made. */
export interface EnsuredItem {
  item: Item;
  created: boolean;
}

/** Finds a live item by its trimmed name, ignoring case, or makes one. */
export async function ensureItem(
  w: Writer,
  name: string,
): Promise<EnsuredItem> {
  const trimmedName = requireName(name, nameMaxLength);
  const wantedKey = trimmedName.toLowerCase();
  const items = liveRows(await w.all("items"));
  const existingItem = items.find(
    (item) => item.name.toLowerCase() === wantedKey,
  );
  if (existingItem) {
    return { item: existingItem, created: false };
  }
  const createdItem: Item = {
    id: newId(),
    revision: 0,
    deletedAt: null,
    name: trimmedName,
    size: null,
    imageId: null,
  };
  await w.put("items", createdItem);
  return { item: createdItem, created: true };
}

/** Renames an item; every line shows the new name through its item id. */
export async function renameItem(
  w: Writer,
  itemId: string,
  name: string,
): Promise<void> {
  const item = await requireLive(w, "items", itemId);
  await w.put("items", { ...item, name: requireName(name, nameMaxLength) });
}

/** Sets or clears an item's usual size. */
export async function setItemSize(
  w: Writer,
  itemId: string,
  size: string | null,
): Promise<void> {
  const item = await requireLive(w, "items", itemId);
  await w.put("items", { ...item, size: optionalText(size, sizeMaxLength) });
}

/** The line tables where two lines for one item on one parent are combined. */
type CombinedLineTable = "mealLines" | "dayLines" | "wantedLines";

/** Repoints every live line of the source at the target, combines duplicates on one meal, day or the extras list, and removes the source. */
export async function mergeItem(
  w: Writer,
  sourceId: string,
  targetId: string,
  now: string,
): Promise<void> {
  if (sourceId === targetId) {
    return;
  }
  await requireLive(w, "items", sourceId);
  await requireLive(w, "items", targetId);

  for (const sourceLine of await liveWhere(
    w,
    "mealLines",
    "itemId",
    sourceId,
  )) {
    const mealLines = await liveWhere(
      w,
      "mealLines",
      "mealId",
      sourceLine.mealId,
    );
    await combineOrRepoint(
      w,
      "mealLines",
      sourceLine,
      mealLines,
      targetId,
      now,
    );
  }
  for (const sourceLine of await liveWhere(w, "dayLines", "itemId", sourceId)) {
    const dayLines = await liveWhere(w, "dayLines", "dayId", sourceLine.dayId);
    await combineOrRepoint(w, "dayLines", sourceLine, dayLines, targetId, now);
  }
  for (const sourceLine of await liveWhere(
    w,
    "wantedLines",
    "itemId",
    sourceId,
  )) {
    const wantedLines = liveRows(await w.all("wantedLines"));
    await combineOrRepoint(
      w,
      "wantedLines",
      sourceLine,
      wantedLines,
      targetId,
      now,
    );
  }
  for (const shopLine of await liveWhere(w, "shopLines", "itemId", sourceId)) {
    await w.put("shopLines", { ...shopLine, itemId: targetId });
  }

  await w.tombstone("items", sourceId, now);
}

/** Adds the source line's count to the target item's line among its siblings, or repoints it when there is none. */
async function combineOrRepoint<T extends CombinedLineTable>(
  w: Writer,
  table: T,
  sourceLine: TableRows[T],
  siblingLines: TableRows[T][],
  targetId: string,
  now: string,
): Promise<void> {
  const targetLine = siblingLines.find((line) => line.itemId === targetId);
  if (!targetLine) {
    await w.put(table, { ...sourceLine, itemId: targetId });
    return;
  }
  await w.put(table, {
    ...targetLine,
    count: targetLine.count + sourceLine.count,
  });
  await w.tombstone(table, sourceLine.id, now);
}

/** The line tables an item's delete removes its lines from; open shops keep theirs. */
const deletedLineTables: readonly CombinedLineTable[] = [
  "mealLines",
  "dayLines",
  "wantedLines",
];

/** Removes an item and its lines on meals, days and the extras list; shop lines stay and show its last name. */
export async function deleteItem(
  w: Writer,
  itemId: string,
  now: string,
): Promise<void> {
  await requireLive(w, "items", itemId);
  for (const table of deletedLineTables) {
    for (const line of await liveWhere(w, table, "itemId", itemId)) {
      await w.tombstone(table, line.id, now);
    }
  }
  await w.tombstone("items", itemId, now);
}
