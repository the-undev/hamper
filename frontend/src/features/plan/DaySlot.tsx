import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { Link } from "@tanstack/react-router";
import { Fragment, useId } from "react";
import { Picture } from "@/components/Picture";
import { SwipeRow } from "@/components/SwipeRow";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { PlannedMeal } from "@/store/types";
import { type DropData, dayCardId, dayEndId } from "./drop";

/** A planned meal as a row shows it: the meal, its picture and its lines in one line. */
export interface PlannedMealView {
  plannedMeal: PlannedMeal;
  /** The picture of the library meal it came from, or null. */
  imageId: string | null;
  /** Its lines' item names in one line. */
  summary: string;
}

/** The line a drop would land on, drawn on the border between two rows without moving them. */
function DropLine() {
  return (
    <li aria-hidden data-drop-line className="relative h-0">
      <div className="absolute inset-x-2 -top-[2px] z-[2] h-[3px] rounded-full bg-accent" />
    </li>
  );
}

/** One planned meal: tapping opens it, a hold anywhere on it (a press with a mouse) lifts it, and a swipe left reveals Remove. */
function PlannedMealRow({
  view,
  index,
  dayLabel,
  onRemove,
}: {
  view: PlannedMealView;
  index: number;
  dayLabel: string;
  onRemove: () => void;
}) {
  const { plannedMeal, imageId, summary } = view;
  const data: DropData = { kind: "meal", plannedMeal };
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } =
    useSortable({ id: plannedMeal.id, data });
  return (
    <li
      ref={setNodeRef}
      data-row-index={index}
      className="border-line border-t"
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
            isDragging && "opacity-40",
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
      className="border-line border-t"
    >
      <Link
        to="/plan/pick/$position"
        params={{ position: String(position) }}
        aria-label={`Add a meal to ${dayLabel}`}
        className="flex min-h-12 items-center px-3 text-sm font-semibold text-accent hover:bg-soft"
      >
        + Add a meal
      </Link>
    </li>
  );
}

/** One day of the plan as a card: the date, its planned meals in their order, and "Add a meal"; during a drag it shows where a drop lands. */
export function DaySlot({
  position,
  date,
  meals,
  dropLineAt,
  targeted,
  onRemove,
}: {
  position: number;
  date: string;
  meals: readonly PlannedMealView[];
  /** The index in `meals` the dragged meal would land before, `meals.length` for the end, or null when a drop would not land here. */
  dropLineAt: number | null;
  /** Whether a drop would land on this day. */
  targeted: boolean;
  onRemove: (plannedMeal: PlannedMeal) => void;
}) {
  const headingId = useId();
  const data: DropData = { kind: "day", position };
  const { setNodeRef } = useDroppable({ id: dayCardId(position), data });
  const label = formatDay(date);
  return (
    <li
      ref={setNodeRef}
      data-position={position}
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
        {meals.length > 1 && (
          <span className="text-xs text-muted">{meals.length} meals</span>
        )}
      </div>
      <ul className="m-0 list-none p-0">
        {meals.map((view, index) => (
          <Fragment key={view.plannedMeal.id}>
            {dropLineAt === index && <DropLine />}
            <PlannedMealRow
              view={view}
              index={index}
              dayLabel={label}
              onRemove={() => onRemove(view.plannedMeal)}
            />
          </Fragment>
        ))}
        {dropLineAt === meals.length && <DropLine />}
        <AddMealRow position={position} index={meals.length} dayLabel={label} />
      </ul>
    </li>
  );
}
