import {
  type CollisionDetection,
  closestCenter,
  type KeyboardCoordinateGetter,
  pointerWithin,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import type { PlannedMeal } from "@/store/types";

/** What a droppable on the Plan is: a planned meal's row, the stand-in a lifted meal leaves where it came from, or a day, whose card and "Add a meal" row both append. */
export type DropData =
  | { kind: "meal"; plannedMeal: PlannedMeal }
  | { kind: "standIn" }
  | { kind: "day"; position: number };

/** Where a drop puts the dragged planned meal: a day and its place among that day's other meals. */
export interface DropPlace {
  position: number;
  rank: number;
}

/** Each day's planned meal ids in their order, by position. */
export type DayOrder = ReadonlyMap<number, readonly string[]>;

/** A planned meal being moved: where it came from, each day's order with the meal where it would land, and whether it is still held. */
export interface Landing {
  id: string;
  source: DropPlace;
  order: DayOrder;
  held: boolean;
}

/** The drag and drop id of the stand-in a lifted meal leaves where it came from. */
export const standInId = "stand-in";

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

/** The arrow keys step a lifted meal to the next row or "Add a meal" row up or down the page, passing over its own slot. */
export const dropKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { active, context },
) => {
  const step =
    event.code === "ArrowDown" ? 1 : event.code === "ArrowUp" ? -1 : 0;
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (step === 0 || !collisionRect) {
    return undefined;
  }
  event.preventDefault();
  let next: { left: number; top: number } | null = null;
  for (const container of droppableContainers.getEnabled()) {
    const rect = droppableRects.get(container.id);
    if (!rect || container.id === active || isDayCard(container.id)) {
      continue;
    }
    // A pixel's slack, so a row the drag already sits on is not the next one.
    const ahead = (rect.top - collisionRect.top) * step > 1;
    if (ahead && (!next || (rect.top - next.top) * step < 0)) {
      next = rect;
    }
  }
  return next ? { x: next.left, y: next.top } : undefined;
};

/** Each day's order as the live data has it. */
export function orderOf(
  mealsByPosition: ReadonlyMap<number, readonly PlannedMeal[]>,
): DayOrder {
  return new Map(
    [...mealsByPosition].map(([position, dayMeals]) => [
      position,
      dayMeals.map((dayMeal) => dayMeal.id),
    ]),
  );
}

/** Each day's order as the screen shows it: the landing's while there is one, with a meal it does not know in its live place and one that has gone left out. */
export function shownOrder(
  mealsByPosition: ReadonlyMap<number, readonly PlannedMeal[]>,
  landing: Landing | null,
): DayOrder {
  const live = orderOf(mealsByPosition);
  if (!landing) {
    return live;
  }
  const liveIds = new Set([...live.values()].flat());
  const knownIds = new Set([...landing.order.values()].flat());
  const shown = new Map<number, string[]>();
  for (const [position, ids] of landing.order) {
    shown.set(
      position,
      ids.filter((id) => liveIds.has(id)),
    );
  }
  for (const [position, ids] of live) {
    const unknownIds = ids.filter((id) => !knownIds.has(id));
    if (unknownIds.length > 0) {
      shown.set(position, [...(shown.get(position) ?? []), ...unknownIds]);
    }
  }
  return shown;
}

/** Where a planned meal sits in an order, or null when it is not in it. */
export function placeIn(order: DayOrder, id: string): DropPlace | null {
  for (const [position, ids] of order) {
    const rank = ids.indexOf(id);
    if (rank >= 0) {
      return { position, rank };
    }
  }
  return null;
}

/** Whether two places are the same day and rank. */
export function samePlace(
  first: DropPlace | null,
  second: DropPlace | null,
): boolean {
  return first?.position === second?.position && first?.rank === second?.rank;
}

/** Lifts a planned meal from an order, or null when it is not in it. */
export function lift(order: DayOrder, id: string): Landing | null {
  const source = placeIn(order, id);
  return source && { id, source, order, held: true };
}

/** Where the lifted meal would land now. */
export function landingPlace(landing: Landing): DropPlace {
  return placeIn(landing.order, landing.id) ?? landing.source;
}

/** Whether the lifted meal would land somewhere other than where it came from. */
export function isMoved(landing: Landing): boolean {
  return !samePlace(landingPlace(landing), landing.source);
}

/** The landing with the lifted meal moved to a place, the same landing when it is already there; a rank past the end appends. */
export function landAt(landing: Landing, place: DropPlace): Landing {
  if (samePlace(landingPlace(landing), place)) {
    return landing;
  }
  const order = new Map<number, readonly string[]>();
  for (const [position, ids] of landing.order) {
    order.set(
      position,
      ids.filter((id) => id !== landing.id),
    );
  }
  const dayIds = [...(order.get(place.position) ?? [])];
  dayIds.splice(Math.min(place.rank, dayIds.length), 0, landing.id);
  order.set(place.position, dayIds);
  return { ...landing, order };
}

/** Puts the lifted meal down: shown where it lands until the data has it there, or null when that is where it came from. */
export function putDown(landing: Landing): Landing | null {
  return isMoved(landing) ? { ...landing, held: false } : null;
}

/** A put-down landing once the live data has every day in its order is null; one still held, or not yet written, stays. */
export function settle(
  landing: Landing | null,
  mealsByPosition: ReadonlyMap<number, readonly PlannedMeal[]>,
): Landing | null {
  if (!landing || landing.held) {
    return landing;
  }
  const live = orderOf(mealsByPosition);
  const positions = new Set([...live.keys(), ...landing.order.keys()]);
  const agrees = [...positions].every(
    (position) =>
      (live.get(position) ?? []).join() ===
      (landing.order.get(position) ?? []).join(),
  );
  return agrees ? null : landing;
}

/** One row of a day: a planned meal, or the stand-in a lifted meal leaves where it came from. */
export interface DayRow {
  id: string;
  standIn: boolean;
}

/** A day's rows in an order: its meals and, while a held meal would land somewhere else, its stand-in where it came from. */
export function rowsOf(
  order: DayOrder,
  position: number,
  landing: Landing | null,
): DayRow[] {
  const ids = order.get(position) ?? [];
  const rows = ids.map((id) => ({ id, standIn: false }));
  if (
    !landing?.held ||
    landing.source.position !== position ||
    !isMoved(landing)
  ) {
    return rows;
  }
  const nextId = ids.filter((id) => id !== landing.id)[landing.source.rank];
  const at = nextId === undefined ? rows.length : ids.indexOf(nextId);
  rows.splice(at, 0, { id: landing.id, standIn: true });
  return rows;
}

/** Where the lifted meal lands with the pointer over a droppable, or null over nothing. Over its own slot it stays and over its stand-in it goes back; a row's lower half puts it after that row, and with no pointer (`below` null) a row takes its place, after it when the meal is above it on that day. */
export function dropPlace(
  landing: Landing,
  over: DropData | undefined,
  below: boolean | null,
): DropPlace | null {
  if (!over) {
    return null;
  }
  if (over.kind === "standIn") {
    return landing.source;
  }
  if (over.kind === "day") {
    const dayIds = landing.order.get(over.position) ?? [];
    return {
      position: over.position,
      rank: dayIds.filter((id) => id !== landing.id).length,
    };
  }
  const overId = over.plannedMeal.id;
  const overPlace = placeIn(landing.order, overId);
  if (overId === landing.id || !overPlace) {
    return landingPlace(landing);
  }
  const dayIds = landing.order.get(overPlace.position) ?? [];
  const draggedIndex = dayIds.indexOf(landing.id);
  const after = below ?? (draggedIndex >= 0 && draggedIndex < overPlace.rank);
  const others = dayIds.filter((id) => id !== landing.id);
  return {
    position: overPlace.position,
    rank: others.indexOf(overId) + (after ? 1 : 0),
  };
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
