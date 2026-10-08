import { ItemTypeAhead } from "@/components/ItemTypeAhead";
import { LineList, lineViews } from "@/components/LineList";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint, sectionLabel } from "@/components/styles";
import {
  addWanted,
  removeWanted,
  setWantedCount,
  setWantedWeekly,
} from "@/domain/wanted";
import { useItemsById } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";

/** The wanted list: things beyond what the days need, each Once or Weekly. */
export function PlanItems() {
  const db = useDb();
  const write = useWrite();
  const itemsById = useItemsById();
  const wantedLines = useLive(
    async () => liveRows(await db.wantedLines.toArray()),
    [db],
  );

  return (
    <>
      <ScreenHeader title="Plan" />
      <ItemTypeAhead
        label="Add an item"
        placeholder="Add an item…"
        addLine={async (w, itemId) => {
          await addWanted(w, itemId, 1);
        }}
      />
      <h2 className={sectionLabel}>
        Wanted{" "}
        <span className="normal-case tracking-normal font-medium">
          beyond what the meals need
        </span>
      </h2>
      {wantedLines && itemsById && (
        <LineList
          lines={lineViews(wantedLines, itemsById)}
          empty="Nothing wanted beyond the meals"
          onCount={(line, count) =>
            void write((w) => setWantedCount(w, line.id, count))
          }
          onRemove={(line) =>
            void write((w) => removeWanted(w, line.id, nowIso()))
          }
          extra={(line) => (
            <button
              type="button"
              aria-label={`${line.name}: ${line.weekly ? "Weekly" : "Once"}`}
              title="Weekly stays when a new plan starts; Once is cleared"
              onClick={() =>
                void write((w) => setWantedWeekly(w, line.id, !line.weekly))
              }
              className={cn(
                "min-h-11 flex-none px-1 text-[11px] font-semibold",
              )}
            >
              <span
                className={cn(
                  "rounded-full px-2 py-0.5",
                  line.weekly
                    ? "bg-warn-soft text-warn"
                    : "bg-soft text-accent",
                )}
              >
                {line.weekly ? "Weekly" : "Once"}
              </span>
            </button>
          )}
        />
      )}
      <p className={hint}>
        Weekly stays when a new plan starts. Once is cleared by it.
      </p>
    </>
  );
}
