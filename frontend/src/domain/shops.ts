import { newId } from "@/store/ids";
import { liveRows } from "@/store/live";
import type { Item, Shop, ShopLine, ShopMeal } from "@/store/types";
import type { Writer } from "@/store/write";
import {
  liveWhere,
  optionalText,
  requireCount,
  requireLive,
  requireName,
} from "./checks";
import { lineName, lineSize } from "./display";
import { requirePlan } from "./plan";
import { addWanted } from "./wanted";

/** The source a shop line names for counts that came from the wanted list. */
export const wantedSource = "wanted";

/** A summed count for one item and the names of the days and list it came from. */
interface ItemTotal {
  count: number;
  sources: string[];
}

/** Makes a shop from the plan: one line per item with the count summed across the days within the length and the wanted list. */
export async function generateShop(
  w: Writer,
  name: string,
  now: string,
): Promise<Shop> {
  const plan = await requirePlan(w);
  const plannedDays = liveRows(await w.all("days"))
    .filter((day) => day.position < plan.lengthDays)
    .sort((first, second) => first.position - second.position);

  const totals = new Map<string, ItemTotal>();
  const addToTotal = (itemId: string, count: number, source: string): void => {
    const total = totals.get(itemId) ?? { count: 0, sources: [] };
    total.count += count;
    total.sources.push(source);
    totals.set(itemId, total);
  };
  for (const day of plannedDays) {
    for (const line of await liveWhere(w, "dayLines", "dayId", day.id)) {
      addToTotal(line.itemId, line.count, day.name);
    }
  }
  for (const line of liveRows(await w.all("wantedLines"))) {
    addToTotal(line.itemId, line.count, wantedSource);
  }

  const plannedMeals: ShopMeal[] = plannedDays.map((day) => ({
    position: day.position,
    name: day.name,
    mealId: day.mealId,
  }));
  const shop: Shop = {
    id: newId(),
    revision: 0,
    deletedAt: null,
    name: requireName(name, null),
    createdAt: now,
    fromPlan: true,
    planStartDate: plan.startDate,
    planLengthDays: plan.lengthDays,
    meals: plannedMeals,
  };
  await w.put("shops", shop);
  for (const [itemId, total] of totals) {
    await w.put("shopLines", {
      ...newLine(shop.id, itemId, now),
      count: total.count,
      sources: total.sources,
    });
  }
  return shop;
}

/** Starts a shop with no lines and no plan, for a quick trip. */
export async function startEmptyShop(
  w: Writer,
  name: string,
  now: string,
): Promise<Shop> {
  const shop: Shop = {
    id: newId(),
    revision: 0,
    deletedAt: null,
    name: requireName(name, null),
    createdAt: now,
    fromPlan: false,
    planStartDate: null,
    planLengthDays: null,
    meals: [],
  };
  await w.put("shops", shop);
  return shop;
}

function newLine(shopId: string, itemId: string, now: string): ShopLine {
  return {
    id: newId(),
    revision: 0,
    deletedAt: null,
    shopId,
    itemId,
    count: 1,
    nameOverride: null,
    sizeOverride: null,
    sources: [],
    ticked: false,
    createdAt: now,
  };
}

/** Adds one of an item to a shop, raising the count of its line when there is one. */
export async function addShopLine(
  w: Writer,
  shopId: string,
  itemId: string,
  now: string,
): Promise<ShopLine> {
  await requireLive(w, "shops", shopId);
  const shopLines = await liveWhere(w, "shopLines", "shopId", shopId);
  const existingLine = shopLines.find((line) => line.itemId === itemId);
  if (existingLine) {
    const grownLine = { ...existingLine, count: existingLine.count + 1 };
    await w.put("shopLines", grownLine);
    return grownLine;
  }
  await requireLive(w, "items", itemId);
  const createdLine = newLine(shopId, itemId, now);
  await w.put("shopLines", createdLine);
  return createdLine;
}

/** What a shop line's edit sets: its own name and size, null to show the item's, and its count. */
export interface ShopLineEdit {
  nameOverride: string | null;
  sizeOverride: string | null;
  count: number;
}

/** Edits a shop line's name, size and count on the shop only. */
export async function editShopLine(
  w: Writer,
  lineId: string,
  edit: ShopLineEdit,
): Promise<void> {
  const line = await requireLive(w, "shopLines", lineId);
  await w.put("shopLines", {
    ...line,
    nameOverride: optionalText(edit.nameOverride, null),
    sizeOverride: optionalText(edit.sizeOverride, null),
    count: requireCount(edit.count, 1),
  });
}

/** Ticks a shop line, or unticks it when ticked is false. */
export async function tickShopLine(
  w: Writer,
  lineId: string,
  ticked: boolean,
): Promise<void> {
  const line = await requireLive(w, "shopLines", lineId);
  await w.put("shopLines", { ...line, ticked });
}

/** Takes a line off a shop. */
export async function removeShopLine(
  w: Writer,
  lineId: string,
  now: string,
): Promise<void> {
  await requireLive(w, "shopLines", lineId);
  await w.tombstone("shopLines", lineId, now);
}

/** Adds the line's count to its item on the wanted list and takes the line off the shop. */
export async function lineToWanted(
  w: Writer,
  lineId: string,
  now: string,
): Promise<void> {
  const line = await requireLive(w, "shopLines", lineId);
  await addWanted(w, line.itemId, line.count);
  await w.tombstone("shopLines", lineId, now);
}

/** Moves every unticked line of a shop to the wanted list. */
export async function restToWanted(
  w: Writer,
  shopId: string,
  now: string,
): Promise<void> {
  await requireLive(w, "shops", shopId);
  for (const line of await liveWhere(w, "shopLines", "shopId", shopId)) {
    if (!line.ticked) {
      await lineToWanted(w, line.id, now);
    }
  }
}

/** Discards a shop and its lines without touching the plan. */
export async function deleteShop(
  w: Writer,
  shopId: string,
  now: string,
): Promise<void> {
  await requireLive(w, "shops", shopId);
  for (const line of await liveWhere(w, "shopLines", "shopId", shopId)) {
    await w.tombstone("shopLines", line.id, now);
  }
  await w.tombstone("shops", shopId, now);
}

/** The shop's live unticked lines as text, one per line, `Name ×count, size` with the size when there is one. */
export function shopText(
  shop: Shop,
  lines: readonly ShopLine[],
  items: readonly Item[],
): string {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const textLines: string[] = [];
  for (const line of liveRows(lines)) {
    const item = itemsById.get(line.itemId);
    // An item row is only ever tombstoned, so it is missing only before it has arrived.
    if (line.shopId !== shop.id || line.ticked || !item) {
      continue;
    }
    const size = lineSize(line, item);
    const countText = `${lineName(line, item)} ×${line.count}`;
    textLines.push(size === null ? countText : `${countText}, ${size}`);
  }
  return textLines.join("\n");
}
