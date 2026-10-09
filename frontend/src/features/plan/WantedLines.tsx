import { ItemTypeAhead } from "@/components/ItemTypeAhead";
import { LineList, lineViews } from "@/components/LineList";
import { Badge } from "@/components/ui/badge";
import { addToWanted } from "@/domain/adds";
import { adjustLineCount } from "@/domain/counts";
import { removeWanted, setWantedWeekly } from "@/domain/wanted";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import { liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";
import type { Item } from "@/store/types";

/** The extras list's type-ahead and lines, each with Once / Weekly, + and −, and a swipe to remove. */
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
        addLine={addToWanted}
      />
      {wantedLines && (
        <LineList
          lines={lineViews(wantedLines, itemsById)}
          empty="No extras beyond the meals"
          onAdjust={(line, step) =>
            void write((w) => adjustLineCount(w, "wantedLines", line.id, step))
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
              <Badge variant={line.weekly ? "warn" : "secondary"}>
                {line.weekly ? "Weekly" : "Once"}
              </Badge>
            </button>
          )}
        />
      )}
    </>
  );
}
