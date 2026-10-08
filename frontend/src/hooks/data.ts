import type { TypeAheadOption } from "@/components/TypeAhead";
import { planId } from "@/store/ids";
import { liveRow, liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";
import type { Day, DayLine, Item, Meal, MealLine, Plan } from "@/store/types";

/** The plan; null until the first pull brings it, undefined while the store is read. */
export function usePlan(): Plan | null | undefined {
  const db = useDb();
  return useLive(async () => liveRow(await db.plan.get(planId)) ?? null, [db]);
}

/** Every item by id, deleted ones included, so a line can show the name its item last had. */
export function useItemsById(): Map<string, Item> | undefined {
  const db = useDb();
  return useLive(
    async () =>
      new Map((await db.items.toArray()).map((item) => [item.id, item])),
    [db],
  );
}

/** Every meal by id, deleted ones included, so a day linked to one can show its picture. */
export function useMealsById(): Map<string, Meal> | undefined {
  const db = useDb();
  return useLive(
    async () =>
      new Map((await db.meals.toArray()).map((meal) => [meal.id, meal])),
    [db],
  );
}

/** The live items, sorted by name. */
export function useLiveItems(): Item[] | undefined {
  const db = useDb();
  return useLive(
    async () =>
      liveRows(await db.items.toArray()).sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
    [db],
  );
}

/** The live library meals, sorted by name. */
export function useLiveMeals(): Meal[] | undefined {
  const db = useDb();
  return useLive(
    async () =>
      liveRows(await db.meals.toArray()).sort((first, second) =>
        first.name.localeCompare(second.name),
      ),
    [db],
  );
}

/** The days holding a planned meal, by position. */
export function usePlannedDays(): Map<number, Day> | undefined {
  const db = useDb();
  return useLive(
    async () =>
      new Map(
        liveRows(await db.days.toArray()).map((day) => [day.position, day]),
      ),
    [db],
  );
}

/** The live lines of every day, grouped by day id. */
export function useDayLinesByDay(): Map<string, DayLine[]> | undefined {
  const db = useDb();
  return useLive(async () => {
    const linesByDay = new Map<string, DayLine[]>();
    for (const line of liveRows(await db.dayLines.toArray())) {
      linesByDay.set(line.dayId, [...(linesByDay.get(line.dayId) ?? []), line]);
    }
    return linesByDay;
  }, [db]);
}

/** Items as type-ahead options, with the usual size beside the name. */
export function itemOptions(items: readonly Item[]): TypeAheadOption[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    detail: item.size,
  }));
}

/** The live lines of every library meal, grouped by meal id. */
export function useMealLinesByMeal(): Map<string, MealLine[]> | undefined {
  const db = useDb();
  return useLive(async () => {
    const linesByMeal = new Map<string, MealLine[]>();
    for (const line of liveRows(await db.mealLines.toArray())) {
      linesByMeal.set(line.mealId, [
        ...(linesByMeal.get(line.mealId) ?? []),
        line,
      ]);
    }
    return linesByMeal;
  }, [db]);
}

/** The names of the lines' items, joined for a one-line summary. */
export function lineNames(
  lines: readonly { itemId: string }[],
  itemsById: ReadonlyMap<string, Item>,
): string {
  return lines
    .map((line) => itemsById.get(line.itemId)?.name)
    .filter((name) => name !== undefined)
    .sort((first, second) => first.localeCompare(second))
    .join(", ");
}
