import type { Item, Plan, ShopLine } from "@/store/types";

/** The name a shop line shows: its own text once edited, else its item's. */
export function lineName(line: ShopLine, item: Item): string {
  return line.nameOverride ?? item.name;
}

/** The size a shop line shows: its own text once edited, else its item's. */
export function lineSize(line: ShopLine, item: Item): string | null {
  return line.sizeOverride ?? item.size;
}

/** The yyyy-MM-dd date of the day at a position, counted from the plan's start date. */
export function dayDate(
  plan: Pick<Plan, "startDate">,
  position: number,
): string {
  const startTime = Date.parse(`${plan.startDate}T00:00:00Z`);
  const dayTime = startTime + position * 24 * 60 * 60 * 1000;
  return new Date(dayTime).toISOString().slice(0, 10);
}
