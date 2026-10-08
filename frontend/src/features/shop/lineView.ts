import { lineName, lineSize } from "@/domain/display";
import type { Item, ShopLine } from "@/store/types";

/** A shop line with the name and size it shows. */
export interface ShopLineView {
  line: ShopLine;
  item: Item;
  name: string;
  size: string | null;
}

/** Joins a shop's lines to their items, leaving out any whose item has not arrived, in the order they were added. */
export function shopLineViews(
  lines: readonly ShopLine[],
  itemsById: ReadonlyMap<string, Item>,
): ShopLineView[] {
  const views: ShopLineView[] = [];
  for (const line of lines) {
    const item = itemsById.get(line.itemId);
    if (item) {
      views.push({
        line,
        item,
        name: lineName(line, item),
        size: lineSize(line, item),
      });
    }
  }
  return views.sort(
    (first, second) =>
      first.line.createdAt.localeCompare(second.line.createdAt) ||
      first.name.localeCompare(second.name),
  );
}
