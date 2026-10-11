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
  useDndContext,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, type SortingStrategy } from "@dnd-kit/sortable";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
import { DaySlot, type PlannedMealView, type SlotRow } from "./DaySlot";
import {
  type DropData,
  type DropPlace,
  dropCollisions,
  dropKeyboardCoordinates,
  dropPlace,
  isMoved,
  type Landing,
  landAt,
  landingPlace,
  lift,
  pointerStartY,
  putDown,
  rowsOf,
  settle,
  shownOrder,
} from "./drop";
import {
  type ShownAt,
  settledRect,
  shownNow,
  slideFrom,
  slideMs,
} from "./slide";

/** A mouse lifts a planned meal once it moves 8px; a finger lifts it after a 250ms hold, so a swipe or a scroll that starts on a row still swipes or scrolls. */
export const plannedMealDragSensorOptions = {
  mouse: { activationConstraint: { distance: 8 } },
  touch: { activationConstraint: { delay: 250, tolerance: 8 } },
} as const;

/** The sorting strategy shifts nothing: the rows move because the landing's order moves the lifted meal, and slide.ts animates every change of place. */
const holdStill: SortingStrategy = () => null;

/** Where a drag over a droppable would land the lifted meal, with the pointer's height deciding before or after the row under it. */
function placeOf(event: DragMoveEvent, landing: Landing): DropPlace | null {
  const { over, delta, activatorEvent } = event;
  if (!over) {
    return null;
  }
  const startY = pointerStartY(activatorEvent);
  const below =
    startY === null
      ? null
      : startY + delta.y > over.rect.top + over.rect.height / 2;
  return dropPlace(landing, over.data.current as DropData | undefined, below);
}

/** Measures every droppable again once the rows move, so a pointer that stays put meets each row where it now is. */
function MeasureAfterMoves({ trigger }: { trigger: unknown }) {
  const { droppableContainers, measureDroppableContainers } = useDndContext();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the trigger is what moves the rows; the effect does not read it.
  useLayoutEffect(() => {
    measureDroppableContainers([...droppableContainers.keys()]);
  }, [trigger, droppableContainers, measureDroppableContainers]);
  return null;
}

/** The plan's days in order, each a card of its planned meals; a meal drags within its day or to another, opening a gap where it would land, and swipes left to remove. */
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
  // The ref holds the landing the handlers last set, which a render may not have caught up with.
  const landingRef = useRef<Landing | null>(null);
  const [landing, setLandingState] = useState<Landing | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // Where the cards and rows showed before the landing changed, until the change is on the screen.
  const shownBefore = useRef<Map<string, ShownAt> | null>(null);
  const setLanding = useCallback((next: Landing | null): void => {
    if (
      next !== landingRef.current &&
      listRef.current &&
      !shownBefore.current
    ) {
      shownBefore.current = shownNow(listRef.current);
    }
    landingRef.current = next;
    setLandingState(next);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new landing is what moved the cards and rows; the effect does not read it.
  useLayoutEffect(() => {
    const before = shownBefore.current;
    shownBefore.current = null;
    if (before && listRef.current) {
      slideFrom(listRef.current, before);
    }
  }, [landing]);
  const sensors = useSensors(
    useSensor(MouseSensor, plannedMealDragSensorOptions.mouse),
    useSensor(TouchSensor, plannedMealDragSensorOptions.touch),
    useSensor(KeyboardSensor, {
      coordinateGetter: dropKeyboardCoordinates(() => landingRef.current),
    }),
  );

  useEffect(() => {
    const settled = settle(landing, mealsByPosition);
    if (settled !== landing && landingRef.current === landing) {
      setLanding(settled);
    }
  }, [landing, mealsByPosition, setLanding]);

  const plannedMealsById = new Map(
    [...mealsByPosition.values()]
      .flat()
      .map((plannedMeal) => [plannedMeal.id, plannedMeal]),
  );
  const shown = shownOrder(mealsByPosition, landing);
  const positions = Array.from({ length: plan.lengthDays }, (_, at) => at);
  const dayLabel = (position: number): string =>
    formatDay(dayDate(plan, position));
  const nameOf = (id: string): string =>
    plannedMealsById.get(id)?.name ?? "the meal";
  const whereItLands = (current: Landing): string => {
    const place = landingPlace(current);
    const nextId = current.order.get(place.position)?.[place.rank + 1];
    const day = dayLabel(place.position);
    return nextId ? `${day}, before ${nameOf(nextId)}` : `the end of ${day}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const current = landingRef.current;
      return current
        ? `Picked up ${nameOf(String(active.id))} from ${dayLabel(current.source.position)}.`
        : undefined;
    },
    onDragOver: () => {
      const current = landingRef.current;
      return current?.held
        ? `${nameOf(current.id)} would go to ${whereItLands(current)}.`
        : undefined;
    },
    onDragEnd: ({ active }) => {
      const current = landingRef.current;
      return current
        ? `Moved ${nameOf(current.id)} to ${whereItLands(current)}.`
        : `Put ${nameOf(String(active.id))} back.`;
    },
    onDragCancel: ({ active }) => `Put ${nameOf(String(active.id))} back.`,
  };

  /** The held landing moved to where the drag is over now, or null when nothing is held. */
  const movedTo = (event: DragMoveEvent): Landing | null => {
    const current = landingRef.current;
    if (!current?.held) {
      return null;
    }
    const place = placeOf(event, current);
    return place ? landAt(current, place) : current;
  };
  const forget = (landed: Landing): void => {
    if (landingRef.current === landed) {
      setLanding(null);
    }
  };
  const onDragStart = ({ active }: DragStartEvent): void => {
    setLanding(
      lift(shownOrder(mealsByPosition, landingRef.current), String(active.id)),
    );
  };
  const onDragMove = (event: DragMoveEvent): void => {
    const next = movedTo(event);
    if (next) {
      setLanding(next);
    }
  };
  const onDragEnd = (event: DragEndEvent): void => {
    // A pointer's last move may not have reached onDragMove yet; a keyboard drag is already where it shows.
    const final =
      pointerStartY(event.activatorEvent) === null
        ? landingRef.current
        : movedTo(event);
    const landed = event.over && final?.held ? putDown(final) : null;
    // The row moves to where it lands in the same render that ends the drag, so the drop animation ends on it.
    setLanding(landed);
    if (!landed) {
      return;
    }
    const place = landingPlace(landed);
    void write(async (w) => {
      await movePlannedMeal(w, landed.id, place.position, place.rank);
      return true;
    }).then(
      (moved) => {
        if (!moved) {
          forget(landed);
        }
      },
      (error: unknown) => {
        forget(landed);
        throw error;
      },
    );
  };

  const viewOf = (plannedMeal: PlannedMeal): PlannedMealView => ({
    plannedMeal,
    imageId:
      (plannedMeal.mealId && mealsById.get(plannedMeal.mealId)?.imageId) ||
      null,
    summary: lineNames(linesByPlannedMeal.get(plannedMeal.id) ?? [], itemsById),
  });
  const held = landing?.held ? landing : null;
  const heldMeal = held ? plannedMealsById.get(held.id) : undefined;
  const slotRowsAt = (position: number): SlotRow[] =>
    rowsOf(shown, position, held).flatMap((row) => {
      const plannedMeal = plannedMealsById.get(row.id);
      if (!plannedMeal) {
        return [];
      }
      const look = row.standIn
        ? "standIn"
        : row.id !== held?.id
          ? "plain"
          : isMoved(held)
            ? "gap"
            : "held";
      return [{ view: viewOf(plannedMeal), look }];
    });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dropCollisions}
      measuring={{
        draggable: { measure: settledRect },
        droppable: { measure: settledRect },
      }}
      accessibility={{ announcements }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragOver={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => setLanding(null)}
    >
      <MeasureAfterMoves trigger={shown} />
      <ol ref={listRef} className="m-0 flex list-none flex-col gap-2 p-0">
        {positions.map((position) => {
          const rows = slotRowsAt(position);
          return (
            <SortableContext
              key={position}
              id={`day-meals-${position}`}
              items={rows.flatMap((row) =>
                row.look === "standIn" ? [] : [row.view.plannedMeal.id],
              )}
              strategy={holdStill}
            >
              <DaySlot
                position={position}
                date={dayDate(plan, position)}
                rows={rows}
                targeted={
                  !!held &&
                  isMoved(held) &&
                  landingPlace(held).position === position
                }
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
      <DragOverlay dropAnimation={{ duration: slideMs, easing: "ease" }}>
        {heldMeal && (
          <div className="flex min-h-[62px] items-center gap-2.5 rounded-[14px] border border-accent bg-surface px-2.5 py-2 shadow-lg">
            <Picture
              name={heldMeal.name}
              imageId={viewOf(heldMeal).imageId}
              size="row"
            />
            <b className="truncate text-[15px] font-semibold">
              {heldMeal.name}
            </b>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
