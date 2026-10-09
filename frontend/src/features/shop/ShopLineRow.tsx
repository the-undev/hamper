import { Counter } from "@/components/Counter";
import { SwipeRow } from "@/components/SwipeRow";
import { Checkbox } from "@/components/ui/checkbox";
import { adjustLineCount } from "@/domain/counts";
import { lineToWanted, removeShopLine } from "@/domain/shops";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ShopLineView } from "./lineView";

/** One line of a list: a tick box, the name with size and sources, and − count +; swiping reveals To extras and Remove. */
export function ShopLineRow({
  view,
  onEdit,
  onTick,
}: {
  view: ShopLineView;
  onEdit: () => void;
  onTick: () => void;
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
          label: "To extras",
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
      <div className="flex min-w-0 items-center gap-1 py-0.5 pr-1 pl-0.5">
        <Checkbox
          aria-label={`${name} in the trolley`}
          checked={line.ticked}
          onCheckedChange={onTick}
          // The box is 26px; its margin and the wider ::after make the 44px target.
          className="m-[9px] size-[26px] flex-none cursor-pointer rounded-lg after:-inset-[9px] data-checked:border-tick data-checked:bg-tick data-checked:text-white [&_svg]:size-4"
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
        <Counter
          count={line.count}
          subject={name}
          onAdjust={(step) =>
            void write((w) => adjustLineCount(w, "shopLines", line.id, step))
          }
        />
      </div>
    </SwipeRow>
  );
}
