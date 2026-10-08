import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  type SortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { dayDate } from "@/domain/display";
import { clearDay, swapDays } from "@/domain/plan";
import { lineNames } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, nowIso } from "@/lib/dates";
import type { Day, DayLine, Item, Meal, Plan } from "@/store/types";
import { DaySlot, slotId } from "./DaySlot";

/** A mouse lifts a day once it moves 8px; a finger lifts it after a 250ms hold, so a scroll that starts on the handle still scrolls. */
export const daySwapSensorOptions = {
  mouse: { activationConstraint: { distance: 8 } },
  touch: { activationConstraint: { delay: 250, tolerance: 8 } },
} as const;

/** Days swap rather than reorder, so no slot moves while one is dragged. */
const holdStill: SortingStrategy = () => null;

function positionOf(id: UniqueIdentifier): number {
  return Number(String(id).replace("slot-", ""));
}

/** The plan's days in order; a filled day drags by its handle onto another to swap, showing the swap before the drop and fading both days in after it. */
export function DayList({
  plan,
  days,
  linesByDay,
  itemsById,
  mealsById,
  onPick,
}: {
  plan: Plan;
  days: ReadonlyMap<number, Day>;
  linesByDay: ReadonlyMap<string, DayLine[]>;
  itemsById: ReadonlyMap<string, Item>;
  mealsById: ReadonlyMap<string, Meal>;
  onPick: (position: number) => void;
}) {
  const write = useWrite();
  const [draggedPosition, setDraggedPosition] = useState<number | null>(null);
  const [overPosition, setOverPosition] = useState<number | null>(null);
  const [swappedPositions, setSwappedPositions] = useState<readonly number[]>(
    [],
  );
  const sensors = useSensors(
    useSensor(MouseSensor, daySwapSensorOptions.mouse),
    useSensor(TouchSensor, daySwapSensorOptions.touch),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const positions = Array.from({ length: plan.lengthDays }, (_, at) => at);
  const labelOf = (id: UniqueIdentifier): string =>
    formatDay(dayDate(plan, positionOf(id)));
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${labelOf(active.id)}.`,
    onDragOver: ({ over }) => (over ? `Over ${labelOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over && over.id !== active.id
        ? `Swapped ${labelOf(active.id)} with ${labelOf(over.id)}.`
        : "Put back.",
    onDragCancel: () => "Put back.",
  };

  const putDown = (): void => {
    setDraggedPosition(null);
    setOverPosition(null);
  };
  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    putDown();
    if (!over || over.id === active.id) {
      return;
    }
    const from = positionOf(active.id);
    const to = positionOf(over.id);
    setSwappedPositions([from, to]);
    void write((w) => swapDays(w, from, to, nowIso()));
  };

  const draggedDay =
    draggedPosition === null ? undefined : days.get(draggedPosition);
  const targetPosition =
    draggedPosition === null || overPosition === draggedPosition
      ? null
      : overPosition;
  const targetName =
    targetPosition === null ? null : (days.get(targetPosition)?.name ?? null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragStart={({ active }) => {
        setDraggedPosition(positionOf(active.id));
        setSwappedPositions([]);
      }}
      onDragOver={({ over }) =>
        setOverPosition(over ? positionOf(over.id) : null)
      }
      onDragEnd={onDragEnd}
      onDragCancel={putDown}
    >
      <SortableContext items={positions.map(slotId)} strategy={holdStill}>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {positions.map((position) => {
            const day = days.get(position);
            return (
              <DaySlot
                key={position}
                position={position}
                date={dayDate(plan, position)}
                day={day}
                imageId={
                  (day?.mealId && mealsById.get(day.mealId)?.imageId) || null
                }
                summary={lineNames(
                  day ? (linesByDay.get(day.id) ?? []) : [],
                  itemsById,
                )}
                targeted={position === targetPosition}
                incomingName={position === draggedPosition ? targetName : null}
                arriving={swappedPositions.includes(position)}
                onPick={() => onPick(position)}
                onClear={() =>
                  void write((w) => clearDay(w, position, nowIso()))
                }
              />
            );
          })}
        </ol>
      </SortableContext>
      <DragOverlay>
        {draggedDay && (
          <div className="rounded-[14px] border border-accent bg-surface px-3 py-2 text-[15px] font-semibold shadow-lg">
            {draggedDay.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
