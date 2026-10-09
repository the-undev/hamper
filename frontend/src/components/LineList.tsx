import { type ReactNode, useState } from "react";
import { Counter } from "./Counter";
import { EmptyState } from "./EmptyState";
import { ItemSheet } from "./ItemSheet";
import { SwipeRow } from "./SwipeRow";
import { listBox } from "./styles";

/** A line as a list shows it: its item's name and size, and its count. */
export interface LineView {
  id: string;
  itemId: string;
  name: string;
  size: string | null;
  count: number;
}

/** Lines with their size under the name, + and − on the count, and a swipe to remove; tapping a name opens its item; a note when there are none. */
export function LineList<L extends LineView>({
  lines,
  empty,
  onCount,
  onRemove,
  extra,
}: {
  lines: readonly L[];
  empty: string;
  onCount: (line: L, count: number) => void;
  onRemove: (line: L) => void;
  /** Anything a list shows between the name and the count, such as Once / Weekly. */
  extra?: (line: L) => ReactNode;
}) {
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  if (lines.length === 0) {
    return <EmptyState>{empty}</EmptyState>;
  }
  return (
    <>
      <ul className={`${listBox} m-0 list-none p-0`}>
        {lines.map((line) => (
          <li key={line.id} className="border-line border-t first:border-t-0">
            <SwipeRow
              subject={line.name}
              actions={[
                {
                  label: "Remove",
                  tone: "danger",
                  onAction: () => onRemove(line),
                },
              ]}
            >
              <div className="flex min-w-0 items-center gap-2.5 py-1 pr-1 pl-3">
                <button
                  type="button"
                  onClick={() => setOpenItemId(line.itemId)}
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center text-left"
                >
                  <b className="truncate text-[15px] font-semibold">
                    {line.name}
                  </b>
                  {line.size && (
                    <small className="truncate text-xs text-muted">
                      {line.size}
                    </small>
                  )}
                </button>
                {extra?.(line)}
                <Counter
                  count={line.count}
                  subject={line.name}
                  onChange={(count) => onCount(line, count)}
                />
              </div>
            </SwipeRow>
          </li>
        ))}
      </ul>
      <ItemSheet itemId={openItemId} onClose={() => setOpenItemId(null)} />
    </>
  );
}

/** Joins lines to their items for display, leaving out any whose item has not arrived, sorted by name. */
export function lineViews<
  T extends { id: string; itemId: string; count: number },
>(
  lines: readonly T[],
  itemsById: ReadonlyMap<string, { name: string; size: string | null }>,
): (T & LineView)[] {
  const views: (T & LineView)[] = [];
  for (const line of lines) {
    const item = itemsById.get(line.itemId);
    if (item) {
      views.push({ ...line, name: item.name, size: item.size });
    }
  }
  return views.sort((first, second) => first.name.localeCompare(second.name));
}
