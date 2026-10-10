import {
  type CollisionDetection,
  closestCenter,
  pointerWithin,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import type { PlannedMeal } from "@/store/types";

/** What a droppable on the Plan is: a planned meal's row, or a day, whose card and "Add a meal" row both append. */
export type DropData =
  | { kind: "meal"; plannedMeal: PlannedMeal }
  | { kind: "day"; position: number };

/** Where a drop puts the dragged planned meal: a day and its place among that day's other meals. */
export interface DropPlace {
  position: number;
  rank: number;
}

/** The drag and drop id of a day's card. */
export function dayCardId(position: number): string {
  return `day-${position}`;
}

/** The drag and drop id of a day's "Add a meal" row. */
export function dayEndId(position: number): string {
  return `day-end-${position}`;
}

function isDayCard(id: UniqueIdentifier): boolean {
  return /^day-\d+$/.test(String(id));
}

/** A row under the pointer wins over the day card around it; with no pointer, the keyboard's, or a pointer between cards, the nearest row. */
export const dropCollisions: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  const rowUnder = underPointer.find((hit) => !isDayCard(hit.id));
  if (rowUnder) {
    return [rowUnder];
  }
  if (underPointer.length > 0) {
    return underPointer;
  }
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => !isDayCard(container.id),
    ),
  });
};

/** Where dropping the dragged planned meal over a droppable puts it, or null when it would stay where it is. A row's lower half puts it after that row; with no pointer (`below` null) a row takes its place, after it when coming from above on the same day. */
export function dropPlace(
  dragged: PlannedMeal,
  over: DropData | undefined,
  below: boolean | null,
  mealsByPosition: ReadonlyMap<number, readonly PlannedMeal[]>,
): DropPlace | null {
  if (!over) {
    return null;
  }
  const position =
    over.kind === "meal" ? over.plannedMeal.position : over.position;
  const dayMeals = mealsByPosition.get(position) ?? [];
  const others = dayMeals.filter((dayMeal) => dayMeal.id !== dragged.id);
  const draggedIndex = dayMeals.findIndex(
    (dayMeal) => dayMeal.id === dragged.id,
  );
  let rank = others.length;
  if (over.kind === "meal") {
    const overId = over.plannedMeal.id;
    if (overId === dragged.id) {
      return null;
    }
    const overIndex = dayMeals.findIndex((dayMeal) => dayMeal.id === overId);
    const after = below ?? (draggedIndex >= 0 && overIndex > draggedIndex);
    rank =
      others.findIndex((dayMeal) => dayMeal.id === overId) + (after ? 1 : 0);
  }
  if (rank === draggedIndex) {
    return null;
  }
  return { position, rank };
}

/** The point a pointer drag started at, or null for a keyboard drag. */
export function pointerStartY(activatorEvent: Event | null): number | null {
  if (activatorEvent instanceof MouseEvent) {
    return activatorEvent.clientY;
  }
  if (
    typeof TouchEvent !== "undefined" &&
    activatorEvent instanceof TouchEvent
  ) {
    return activatorEvent.touches[0]?.clientY ?? null;
  }
  return null;
}
