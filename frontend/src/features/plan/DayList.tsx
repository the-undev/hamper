import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  type SortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { Picture } from "@/components/Picture";
import { dayDate } from "@/domain/display";
import { movePlannedMeal, removePlannedMeal } from "@/domain/plan";
import { lineNames } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, nowIso } from "@/lib/dates";
import type {
  Item,
  Meal,
  Plan,
  PlannedMeal,
  PlannedMealLine,
} from "@/store/types";
import { DaySlot, type PlannedMealView } from "./DaySlot";
import {
  type DropData,
  type DropPlace,
  dropCollisions,
  dropPlace,
  pointerStartY,
} from "./drop";

/** A mouse lifts a planned meal once it moves 8px; a finger lifts it after a 250ms hold, so a swipe or a scroll that starts on a row still swipes or scrolls. */
export const plannedMealDragSensorOptions = {
  mouse: { activationConstraint: { distance: 8 } },
  touch: { activationConstraint: { delay: 250, tolerance: 8 } },
} as const;

/** The rows stay where they are during a drag; a line shows where the drop lands. */
const holdStill: SortingStrategy = () => null;

/** Where a drag over a droppable would put the dragged planned meal, with a pointer's height deciding before or after the row under it. */
function placeOf(
  event: DragMoveEvent,
  mealsByPosition: ReadonlyMap<number, readonly PlannedMeal[]>,
): DropPlace | null {
  const { active, over, delta, activatorEvent } = event;
  const dragged = (active.data.current as DropData | undefined) ?? undefined;
  if (!over || dragged?.kind !== "meal") {
    return null;
  }
  const startY = pointerStartY(activatorEvent);
  const below =
    startY === null
      ? null
      : startY + delta.y > over.rect.top + over.rect.height / 2;
  return dropPlace(
    dragged.plannedMeal,
    over.data.current as DropData | undefined,
    below,
    mealsByPosition,
  );
}

function samePlace(first: DropPlace | null, second: DropPlace | null): boolean {
  return first?.position === second?.position && first?.rank === second?.rank;
}

/** The plan's days in order, each a card of its planned meals; a meal drags within its day or to another, between the meals there, and swipes left to remove. */
export function DayList({
  plan,
  mealsByPosition,
  linesByPlannedMeal,
  itemsById,
  mealsById,
}: {
  plan: Plan;
  mealsByPosition: ReadonlyMap<number, readonly PlannedMeal[]>;
  linesByPlannedMeal: ReadonlyMap<string, PlannedMealLine[]>;
  itemsById: ReadonlyMap<string, Item>;
  mealsById: ReadonlyMap<string, Meal>;
}) {
  const write = useWrite();
  const [dragged, setDragged] = useState<PlannedMeal | null>(null);
  const [place, setPlace] = useState<DropPlace | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, plannedMealDragSensorOptions.mouse),
    useSensor(TouchSensor, plannedMealDragSensorOptions.touch),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const positions = Array.from({ length: plan.lengthDays }, (_, at) => at);
  const dayLabel = (position: number): string =>
    formatDay(dayDate(plan, position));
  const droppableLabel = (data: DropData | undefined): string => {
    if (data?.kind === "meal") {
      return `${data.plannedMeal.name} on ${dayLabel(data.plannedMeal.position)}`;
    }
    return data ? dayLabel(data.position) : "nothing";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${droppableLabel(active.data.current as DropData | undefined)}.`,
    onDragOver: ({ over }) =>
      over
        ? `Over ${droppableLabel(over.data.current as DropData | undefined)}.`
        : undefined,
    onDragEnd: ({ over }) =>
      over
        ? `Dropped on ${droppableLabel(over.data.current as DropData | undefined)}.`
        : "Put back.",
    onDragCancel: () => "Put back.",
  };

  const putDown = (): void => {
    setDragged(null);
    setPlace(null);
  };
  const onDragStart = ({ active }: DragStartEvent): void => {
    const data = active.data.current as DropData | undefined;
    setDragged(data?.kind === "meal" ? data.plannedMeal : null);
  };
  const onDragMove = (event: DragMoveEvent): void => {
    const nextPlace = placeOf(event, mealsByPosition);
    if (!samePlace(nextPlace, place)) {
      setPlace(nextPlace);
    }
  };
  const onDragEnd = (event: DragEndEvent): void => {
    const target = placeOf(event, mealsByPosition);
    putDown();
    if (!target) {
      return;
    }
    void write((w) =>
      movePlannedMeal(w, String(event.active.id), target.position, target.rank),
    );
  };

  const viewOf = (plannedMeal: PlannedMeal): PlannedMealView => ({
    plannedMeal,
    imageId:
      (plannedMeal.mealId && mealsById.get(plannedMeal.mealId)?.imageId) ||
      null,
    summary: lineNames(linesByPlannedMeal.get(plannedMeal.id) ?? [], itemsById),
  });
  const dropLineAt = (position: number): number | null => {
    if (!dragged || place?.position !== position) {
      return null;
    }
    const dayMeals = mealsByPosition.get(position) ?? [];
    const others = dayMeals.filter((dayMeal) => dayMeal.id !== dragged.id);
    const before = others[place.rank];
    return before ? dayMeals.indexOf(before) : dayMeals.length;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dropCollisions}
      accessibility={{ announcements }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragOver={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={putDown}
    >
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {positions.map((position) => {
          const dayMeals = mealsByPosition.get(position) ?? [];
          return (
            <SortableContext
              key={position}
              id={`day-meals-${position}`}
              items={dayMeals.map((dayMeal) => dayMeal.id)}
              strategy={holdStill}
            >
              <DaySlot
                position={position}
                date={dayDate(plan, position)}
                meals={dayMeals.map(viewOf)}
                dropLineAt={dropLineAt(position)}
                targeted={place?.position === position}
                onRemove={(plannedMeal) =>
                  void write((w) =>
                    removePlannedMeal(w, plannedMeal.id, nowIso()),
                  )
                }
              />
            </SortableContext>
          );
        })}
      </ol>
      <DragOverlay>
        {dragged && (
          <div className="flex min-h-[62px] items-center gap-2.5 rounded-[14px] border border-accent bg-surface px-2.5 py-2 shadow-lg">
            <Picture
              name={dragged.name}
              imageId={viewOf(dragged).imageId}
              size="row"
            />
            <b className="truncate text-[15px] font-semibold">{dragged.name}</b>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
