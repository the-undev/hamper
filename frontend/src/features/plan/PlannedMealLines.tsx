import { ItemTypeAhead } from "@/components/ItemTypeAhead";
import { LineList, lineViews } from "@/components/LineList";
import { addToPlannedMeal } from "@/domain/adds";
import { adjustLineCount } from "@/domain/counts";
import { setPlannedMealLine } from "@/domain/plan";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import type { Item, PlannedMealLine } from "@/store/types";

/** A planned meal's type-ahead and lines, each with + and − and a swipe to remove, edited for it only. */
export function PlannedMealLines({
  plannedMealId,
  lines,
  itemsById,
  typeAheadLabel,
}: {
  plannedMealId: string;
  lines: readonly PlannedMealLine[];
  itemsById: ReadonlyMap<string, Item>;
  typeAheadLabel: string;
}) {
  const write = useWrite();
  return (
    <>
      <ItemTypeAhead
        label={typeAheadLabel}
        placeholder={`${typeAheadLabel}…`}
        addLine={(w, itemId) =>
          addToPlannedMeal(w, plannedMealId, itemId, nowIso())
        }
      />
      <LineList
        lines={lineViews(lines, itemsById)}
        empty="Nothing to buy for this meal"
        onAdjust={(line, step) =>
          void write((w) =>
            adjustLineCount(w, "plannedMealLines", line.id, step),
          )
        }
        onRemove={(line) =>
          void write((w) =>
            setPlannedMealLine(w, plannedMealId, line.itemId, 0, nowIso()),
          )
        }
      />
    </>
  );
}
