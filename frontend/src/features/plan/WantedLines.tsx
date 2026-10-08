import { ItemTypeAhead } from "@/components/ItemTypeAhead";
import { LineList, lineViews } from "@/components/LineList";
import {
  addWanted,
  removeWanted,
  setWantedCount,
  setWantedWeekly,
} from "@/domain/wanted";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";
import type { Item } from "@/store/types";

/** The wanted list's type-ahead and lines, each with Once / Weekly, + and −, and a swipe to remove. */
export function WantedLines({
  itemsById,
  typeAheadLabel,
}: {
  itemsById: ReadonlyMap<string, Item>;
  typeAheadLabel: string;
}) {
  const db = useDb();
  const write = useWrite();
  const wantedLines = useLive(
    async () => liveRows(await db.wantedLines.toArray()),
    [db],
  );
  return (
    <>
      <ItemTypeAhead
        label={typeAheadLabel}
        placeholder={`${typeAheadLabel}…`}
        addLine={async (w, itemId) => {
          await addWanted(w, itemId, 1);
        }}
      />
      {wantedLines && (
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
              className="min-h-11 flex-none px-1 text-[11px] font-semibold"
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
    </>
  );
}
