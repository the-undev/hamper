import type { Table } from "dexie";
import type { TypeAheadOption } from "@/components/TypeAhead";
import { byPlanOrder } from "@/domain/display";
import { planId } from "@/store/ids";
import { liveRow, liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";
import type {
  Item,
  Meal,
  MealLine,
  Plan,
  PlannedMeal,
  PlannedMealLine,
  SyncedRow,
} from "@/store/types";

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

/** Every meal by id, deleted ones included, so a planned meal linked to one can show its picture. */
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

/** The live planned meals by position, each day's in their order; a day with none has no entry. */
export function usePlannedMealsByPosition():
  | Map<number, PlannedMeal[]>
  | undefined {
  const db = useDb();
  return useLive(async () => {
    const mealsByPosition = new Map<number, PlannedMeal[]>();
    const plannedMeals = liveRows(await db.plannedMeals.toArray());
    for (const plannedMeal of plannedMeals.sort(byPlanOrder)) {
      mealsByPosition.set(plannedMeal.position, [
        ...(mealsByPosition.get(plannedMeal.position) ?? []),
        plannedMeal,
      ]);
    }
    return mealsByPosition;
  }, [db]);
}

/** The live lines of every planned meal, grouped by planned meal id. */
export function usePlannedMealLinesByPlannedMeal():
  | Map<string, PlannedMealLine[]>
  | undefined {
  const db = useDb();
  return useLive(async () => {
    const linesByPlannedMeal = new Map<string, PlannedMealLine[]>();
    for (const line of liveRows(await db.plannedMealLines.toArray())) {
      linesByPlannedMeal.set(line.plannedMealId, [
        ...(linesByPlannedMeal.get(line.plannedMealId) ?? []),
        line,
      ]);
    }
    return linesByPlannedMeal;
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

/** Where an item is used: how many meals, days and lists, the extras list counting as one, have a line of it. */
export interface ItemUsage {
  meals: number;
  days: number;
  lists: number;
}

/** How many of the rows are live. */
function liveCount(rows: readonly (SyncedRow | undefined)[]): number {
  return rows.filter((row) => liveRow(row)).length;
}

/** Counts the live meals, the days with a live planned meal, and the open shops with a live line of the item, and the extras list when it has one. */
export function useItemUsage(itemId: string): ItemUsage | undefined {
  const db = useDb();
  return useLive(async () => {
    const linesOf = <L extends SyncedRow>(table: Table<L, string>) =>
      table.where("itemId").equals(itemId).toArray().then(liveRows);
    const parentIds = <L>(lines: L[], parentId: (line: L) => string) => [
      ...new Set(lines.map(parentId)),
    ];
    const mealLines = await linesOf(db.mealLines);
    const plannedMealLines = await linesOf(db.plannedMealLines);
    const shopLines = await linesOf(db.shopLines);
    const wantedLines = await linesOf(db.wantedLines);
    const meals = await db.meals.bulkGet(
      parentIds(mealLines, (line) => line.mealId),
    );
    const plannedMeals = await db.plannedMeals.bulkGet(
      parentIds(plannedMealLines, (line) => line.plannedMealId),
    );
    const dayPositions = new Set(
      plannedMeals
        .filter((plannedMeal) => liveRow(plannedMeal))
        .map((plannedMeal) => plannedMeal?.position),
    );
    const shops = await db.shops.bulkGet(
      parentIds(shopLines, (line) => line.shopId),
    );
    return {
      meals: liveCount(meals),
      days: dayPositions.size,
      lists: liveCount(shops) + (wantedLines.length > 0 ? 1 : 0),
    };
  }, [db, itemId]);
}
