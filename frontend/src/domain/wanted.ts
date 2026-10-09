import { newId } from "@/store/ids";
import { liveRows } from "@/store/live";
import type { WantedLine } from "@/store/types";
import type { Writer } from "@/store/write";
import { requireCount, requireLive } from "./checks";

/** Adds to the count of the item's wanted line, or puts the item on the list as Once with that count. */
export async function addWanted(
  w: Writer,
  itemId: string,
  addedCount: number,
): Promise<WantedLine> {
  requireCount(addedCount, 1);
  const wantedLines = liveRows(await w.all("wantedLines"));
  const existingLine = wantedLines.find((line) => line.itemId === itemId);
  if (existingLine) {
    const grownLine = {
      ...existingLine,
      count: existingLine.count + addedCount,
    };
    await w.put("wantedLines", grownLine);
    return grownLine;
  }
  await requireLive(w, "items", itemId);
  const createdLine: WantedLine = {
    id: newId(),
    revision: 0,
    deletedAt: null,
    itemId,
    count: addedCount,
    weekly: false,
  };
  await w.put("wantedLines", createdLine);
  return createdLine;
}

/** Sets a wanted line's count. */
export async function setWantedCount(
  w: Writer,
  lineId: string,
  count: number,
): Promise<void> {
  const line = await requireLive(w, "wantedLines", lineId);
  await w.put("wantedLines", { ...line, count: requireCount(count, 1) });
}

/** Marks a wanted line Weekly, or Once when weekly is false. */
export async function setWantedWeekly(
  w: Writer,
  lineId: string,
  weekly: boolean,
): Promise<void> {
  const line = await requireLive(w, "wantedLines", lineId);
  await w.put("wantedLines", { ...line, weekly });
}

/** Takes a line off the wanted list. */
export async function removeWanted(
  w: Writer,
  lineId: string,
  now: string,
): Promise<void> {
  await requireLive(w, "wantedLines", lineId);
  await w.tombstone("wantedLines", lineId, now);
}
