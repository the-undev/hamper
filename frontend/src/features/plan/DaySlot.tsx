import { useDroppable } from "@dnd-kit/core";
import { type AnimateLayoutChanges, useSortable } from "@dnd-kit/sortable";
import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { Picture } from "@/components/Picture";
import { SwipeRow } from "@/components/SwipeRow";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PlannedMeal } from "@/store/types";
import { type DropData, dayCardId, dayEndId, standInId } from "./drop";

/** A planned meal as a row shows it: the meal, its picture and its lines in one line. */
export interface PlannedMealView {
  plannedMeal: PlannedMeal;
  /** The picture of the library meal it came from, or null. */
  imageId: string | null;
  /** Its lines' item names in one line. */
  summary: string;
}

/** One row of a day's card: a planned meal and how it shows during a drag. */
export interface SlotRow {
  view: PlannedMealView;
  /** Plain; held where it came from; the gap where a held meal would land; or the stand-in it leaves where it came from. */
  look: "plain" | "held" | "gap" | "standIn";
}

/** The rows slide through slide.ts with their cards, so dnd-kit animates none of them. */
const noLayoutAnimation: AnimateLayoutChanges = () => false;

/** One planned meal: tapping opens it, a hold anywhere on it (a press with a mouse) lifts it, and a swipe left reveals Remove; while it is held elsewhere it is the gap where it would land. */
function PlannedMealRow({
  row,
  index,
  dayLabel,
  onRemove,
}: {
  row: SlotRow;
  index: number;
  dayLabel: string;
  onRemove: () => void;
}) {
  const { plannedMeal, imageId, summary } = row.view;
  const data: DropData = { kind: "meal", plannedMeal };
  const { setNodeRef, setActivatorNodeRef, attributes, listeners } =
    useSortable({
      id: plannedMeal.id,
      data,
      animateLayoutChanges: noLayoutAnimation,
    });
  const gap = row.look === "gap";
  return (
    <li
      ref={setNodeRef}
      data-row-index={index}
      data-gap={gap || undefined}
      data-slide={plannedMeal.id}
      className={cn("border-line border-t", gap && "bg-soft *:invisible")}
    >
      <SwipeRow
        subject={`${plannedMeal.name} from ${dayLabel}`}
        actions={[{ label: "Remove", tone: "danger", onAction: onRemove }]}
      >
        <div
          data-drag-handle
          {...listeners}
          className={cn(
            "flex min-h-[62px] cursor-grab items-center gap-2.5 px-2.5 py-2 [-webkit-touch-callout:none]",
            row.look === "held" && "opacity-40",
          )}
        >
          <Picture name={plannedMeal.name} imageId={imageId} size="row" />
          <Link
            to="/plan/meal/$plannedMealId"
            params={{ plannedMealId: plannedMeal.id }}
            draggable={false}
            className="flex min-h-11 min-w-0 flex-1 flex-col justify-center"
          >
            <b className="truncate text-[15px] font-semibold">
              {plannedMeal.name}
            </b>
            <small className="truncate text-xs text-muted">
              {summary || "nothing to buy"}
            </small>
          </Link>
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            aria-label={`Move ${plannedMeal.name} from ${dayLabel}`}
            className="sr-only rounded-[10px] text-[13px] font-semibold text-accent focus-visible:not-sr-only focus-visible:min-h-11 focus-visible:px-2"
          >
            Move
          </button>
        </div>
      </SwipeRow>
    </li>
  );
}

/** What a held meal leaves where it came from while it would land elsewhere: the row dimmed, which takes it back when the pointer returns to it. */
function StandInRow({ row, index }: { row: SlotRow; index: number }) {
  const { plannedMeal, imageId, summary } = row.view;
  const data: DropData = { kind: "standIn" };
  const { setNodeRef } = useDroppable({ id: standInId, data });
  return (
    <li
      ref={setNodeRef}
      aria-hidden
      data-row-index={index}
      data-stand-in
      data-slide={standInId}
      className="border-line border-t"
    >
      <div className="flex min-h-[62px] items-center gap-2.5 px-2.5 py-2 opacity-40">
        <Picture name={plannedMeal.name} imageId={imageId} size="row" />
        <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
          <b className="truncate text-[15px] font-semibold">
            {plannedMeal.name}
          </b>
          <small className="truncate text-xs text-muted">
            {summary || "nothing to buy"}
          </small>
        </div>
      </div>
    </li>
  );
}

/** The "Add a meal" row at the end of a day, which opens the picker and takes a drop at the end of the day. */
function AddMealRow({
  position,
  index,
  dayLabel,
}: {
  position: number;
  index: number;
  dayLabel: string;
}) {
  const data: DropData = { kind: "day", position };
  const { setNodeRef } = useDroppable({ id: dayEndId(position), data });
  return (
    <li
      ref={setNodeRef}
      data-row-index={index}
      data-slide={dayEndId(position)}
      className="border-line border-t"
    >
      <Link
        to="/plan/pick/$position"
        params={{ position: String(position) }}
        aria-label={`Add a meal to ${dayLabel}`}
        draggable={false}
        className="flex min-h-12 items-center px-3 text-sm font-semibold text-accent hover:bg-soft"
      >
        + Add a meal
      </Link>
    </li>
  );
}

/** One day of the plan as a card: the date, its planned meals in their order, and "Add a meal"; during a drag it opens a gap where a drop lands. */
export function DaySlot({
  position,
  date,
  rows,
  targeted,
  onRemove,
}: {
  position: number;
  date: string;
  /** The day's rows in order, with any gap and stand-in of a drag. */
  rows: readonly SlotRow[];
  /** Whether a drop would land on this day. */
  targeted: boolean;
  onRemove: (plannedMeal: PlannedMeal) => void;
}) {
  const headingId = useId();
  const data: DropData = { kind: "day", position };
  const { setNodeRef } = useDroppable({ id: dayCardId(position), data });
  const label = formatDay(date);
  const mealCount = rows.filter((row) => row.look !== "standIn").length;
  return (
    <li
      ref={setNodeRef}
      data-position={position}
      data-slide={dayCardId(position)}
      aria-labelledby={headingId}
      className={cn(
        "overflow-hidden rounded-[14px] border border-line bg-surface",
        targeted && "border-accent",
      )}
    >
      <div className="flex min-h-9 items-center justify-between gap-2 px-3">
        <h2 id={headingId} className="m-0 text-[13px] font-bold">
          {label}
        </h2>
        {mealCount > 1 && (
          <span className="text-xs text-muted">{mealCount} meals</span>
        )}
      </div>
      <ul className="m-0 list-none p-0">
        {rows.map((row, index) =>
          row.look === "standIn" ? (
            <StandInRow key={standInId} row={row} index={index} />
          ) : (
            <PlannedMealRow
              key={row.view.plannedMeal.id}
              row={row}
              index={index}
              dayLabel={label}
              onRemove={() => onRemove(row.view.plannedMeal)}
            />
          ),
        )}
        <AddMealRow position={position} index={rows.length} dayLabel={label} />
      </ul>
    </li>
  );
}
