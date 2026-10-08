import { ItemTypeAhead } from "@/components/ItemTypeAhead";
import { LineList, lineViews } from "@/components/LineList";
import { liveWhere } from "@/domain/checks";
import { setDayLine } from "@/domain/plan";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import { dayIdFor } from "@/store/ids";
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
        addLine={async (w, itemId) => {
          const currentLines = await liveWhere(
            w,
            "dayLines",
            "dayId",
            dayIdFor(position),
          );
          const currentCount =
            currentLines.find((line) => line.itemId === itemId)?.count ?? 0;
          await setDayLine(w, position, itemId, currentCount + 1, nowIso());
        }}
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
