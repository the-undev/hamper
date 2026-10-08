import { SwipeRow } from "@/components/SwipeRow";
import { lineToWanted, removeShopLine, tickShopLine } from "@/domain/shops";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ShopLineView } from "./lineView";

/** One line of a list: a tick box, the name with size and sources, and the count; swiping reveals To wanted and Remove. */
export function ShopLineRow({
  view,
  onEdit,
}: {
  view: ShopLineView;
  onEdit: () => void;
}) {
  const write = useWrite();
  const { line, name, size } = view;
  const detail = [size, line.sources.join(", ")]
    .filter((part) => part)
    .join(" · ");
  return (
    <SwipeRow
      subject={name}
      actions={[
        {
          label: "To wanted",
          tone: "accent",
          onAction: () => void write((w) => lineToWanted(w, line.id, nowIso())),
        },
        {
          label: "Remove",
          tone: "danger",
          onAction: () =>
            void write((w) => removeShopLine(w, line.id, nowIso())),
        },
      ]}
    >
      <div className="flex min-w-0 items-center gap-1 py-0.5 pr-3 pl-0.5">
        <input
          type="checkbox"
          aria-label={`${name} in the trolley`}
          checked={line.ticked}
          onChange={() =>
            void write((w) => tickShopLine(w, line.id, !line.ticked))
          }
          className="size-11 flex-none cursor-pointer appearance-none before:m-[9px] before:grid before:size-[26px] before:place-items-center before:rounded-lg before:border-2 before:border-line before:text-sm before:text-white before:content-[''] checked:before:border-tick checked:before:bg-tick checked:before:content-['✓']"
        />
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 flex-col justify-center text-left",
            line.ticked && "text-muted line-through",
          )}
        >
          <b className="truncate text-[15px] font-semibold">{name}</b>
          {detail && (
            <small className="truncate text-xs text-muted">{detail}</small>
          )}
        </button>
        <span className="min-w-8 text-right font-bold tabular-nums">
          ×{line.count}
        </span>
      </div>
    </SwipeRow>
  );
}
