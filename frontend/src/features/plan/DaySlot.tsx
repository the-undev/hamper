import { useSortable } from "@dnd-kit/sortable";
import { Link } from "@tanstack/react-router";
import { Picture } from "@/components/Picture";
import { SwipeRow } from "@/components/SwipeRow";
import { formatDay, formatDayOfMonth, formatWeekday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Day } from "@/store/types";

/** The drag and drop id of the slot at a position. */
export function slotId(position: number): string {
  return `slot-${position}`;
}

const slotClasses =
  "flex min-h-[62px] items-center gap-2.5 rounded-[14px] border border-line px-2.5 py-2";

/** Fades a slot in once it has taken another day's meal in a swap. */
const arrivingClasses =
  "animate-in fade-in duration-150 motion-reduce:animate-none";

/** What a drop on the slot under the dragged day does, in place of its handle. */
function DropLabel({ filled }: { filled: boolean }) {
  return (
    <span className="grid min-h-11 flex-none place-items-center px-1.5 text-[13px] font-bold text-accent">
      {filled ? "Swap" : "Move here"}
    </span>
  );
}

function DayLabel({ date }: { date: string }) {
  return (
    <span className="flex w-11 flex-none flex-col items-center leading-tight">
      <b className="text-[13px]">{formatWeekday(date)}</b>
      <small className="text-[11px] text-muted">{formatDayOfMonth(date)}</small>
    </span>
  );
}

/** One day of the plan: "Pick a meal" when empty, else the meal with its lines, a drag handle and a swipe to clear; during a drag it shows what a drop does. */
export function DaySlot({
  position,
  date,
  day,
  imageId,
  summary,
  targeted,
  incomingName,
  arriving,
  onPick,
  onClear,
}: {
  position: number;
  date: string;
  day: Day | undefined;
  /** The picture of the library meal the day came from, or null. */
  imageId: string | null;
  /** The day's lines in one line. */
  summary: string;
  /** Whether the dragged day is over this slot. */
  targeted: boolean;
  /** On the dragged day's own slot, the name of the day it would swap with, shown faintly; else null. */
  incomingName: string | null;
  /** Whether the slot has just taken part in a swap. */
  arriving: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } =
    useSortable({
      id: slotId(position),
      disabled: { draggable: !day, droppable: false },
    });
  const label = formatDay(date);

  if (!day) {
    return (
      <li
        ref={setNodeRef}
        data-position={position}
        className={cn(
          slotClasses,
          "border-dashed",
          targeted && "border-accent bg-soft",
          arriving && arrivingClasses,
        )}
      >
        <DayLabel date={date} />
        <button
          type="button"
          aria-label={`Pick a meal for ${label}`}
          onClick={onPick}
          className="min-h-11 flex-1 text-left text-sm font-semibold text-accent"
        >
          + Pick a meal
        </button>
        {targeted && <DropLabel filled={false} />}
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      data-position={position}
      className={cn("rounded-[14px]", arriving && arrivingClasses)}
    >
      <SwipeRow
        subject={label}
        actions={[{ label: "Clear", tone: "danger", onAction: onClear }]}
        rounded="rounded-[14px]"
      >
        <div
          className={cn(
            slotClasses,
            targeted && "border-accent bg-soft",
            isDragging && "opacity-40",
          )}
        >
          <DayLabel date={date} />
          <Picture name={day.name} imageId={imageId} size="row" />
          <Link
            to="/plan/day/$position"
            params={{ position: String(position) }}
            draggable={false}
            className="flex min-h-11 min-w-0 flex-1 flex-col justify-center"
          >
            <b
              className={cn(
                "truncate text-[15px] font-semibold",
                incomingName && "font-normal text-muted italic",
              )}
            >
              {incomingName ?? day.name}
            </b>
            <small className="truncate text-xs text-muted">
              {incomingName ? "\u00a0" : summary || "nothing to buy"}
            </small>
          </Link>
          {targeted ? (
            <DropLabel filled />
          ) : (
            <button
              ref={setActivatorNodeRef}
              type="button"
              data-drag-handle
              {...attributes}
              {...listeners}
              aria-label={`Move ${day.name} from ${label}`}
              className="grid size-11 flex-none cursor-grab touch-none select-none place-items-center rounded-[10px] text-[22px] text-muted hover:bg-line"
            >
              ≡
            </button>
          )}
        </div>
      </SwipeRow>
    </li>
  );
}
