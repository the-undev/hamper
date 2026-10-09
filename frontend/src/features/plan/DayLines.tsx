import { ItemTypeAhead } from "@/components/ItemTypeAhead";
import { LineList, lineViews } from "@/components/LineList";
import { addToDay } from "@/domain/adds";
import { setDayLine } from "@/domain/plan";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import type { DayLine, Item } from "@/store/types";

/** A day's type-ahead and lines, each with + and − and a swipe to remove, edited for that day only. */
export function DayLines({
  position,
  lines,
  itemsById,
  typeAheadLabel,
}: {
  position: number;
  lines: readonly DayLine[];
  itemsById: ReadonlyMap<string, Item>;
  typeAheadLabel: string;
}) {
  const write = useWrite();
  return (
    <>
      <ItemTypeAhead
        label={typeAheadLabel}
        placeholder={`${typeAheadLabel}…`}
        addLine={(w, itemId) => addToDay(w, position, itemId, nowIso())}
      />
      <LineList
        lines={lineViews(lines, itemsById)}
        empty="Nothing to buy for this day"
        onCount={(line, count) =>
          void write((w) =>
            setDayLine(w, position, line.itemId, count, nowIso()),
          )
        }
        onRemove={(line) =>
          void write((w) => setDayLine(w, position, line.itemId, 0, nowIso()))
        }
      />
    </>
  );
}
