import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
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
import type { Day, DayLine, Item, Plan } from "@/store/types";
import { DaySlot, slotId } from "./DaySlot";

/** Days swap rather than reorder, so no slot moves while one is dragged. */
const holdStill: SortingStrategy = () => null;

function positionOf(id: UniqueIdentifier): number {
  return Number(String(id).replace("slot-", ""));
}

/** The plan's days in order; a filled day drags by its handle, after a press and hold, onto another to swap. */
export function DayList({
  plan,
  days,
  linesByDay,
  itemsById,
  onPick,
}: {
  plan: Plan;
  days: ReadonlyMap<number, Day>;
  linesByDay: ReadonlyMap<string, DayLine[]>;
  itemsById: ReadonlyMap<string, Item>;
  onPick: (position: number) => void;
}) {
  const write = useWrite();
  const [draggedPosition, setDraggedPosition] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
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

  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    setDraggedPosition(null);
    if (!over || over.id === active.id) {
      return;
    }
    void write((w) =>
      swapDays(w, positionOf(active.id), positionOf(over.id), nowIso()),
    );
  };

  const draggedDay =
    draggedPosition === null ? undefined : days.get(draggedPosition);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragStart={({ active }) => setDraggedPosition(positionOf(active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggedPosition(null)}
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
                summary={lineNames(
                  day ? (linesByDay.get(day.id) ?? []) : [],
                  itemsById,
                )}
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
