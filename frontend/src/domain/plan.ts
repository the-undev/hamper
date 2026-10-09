import { newId, planId } from "@/store/ids";
import { liveRow, liveRows } from "@/store/live";
import type { Meal, Plan, PlannedMeal, ShopMeal } from "@/store/types";
import type { Writer } from "@/store/write";
import {
  DomainError,
  liveWhere,
  nameMaxLength,
  requireCount,
  requireLive,
  requireName,
} from "./checks";
import type { CountStep } from "./counts";
import { byPlanOrder, dayDate } from "./display";
import { createMeal } from "./meals";

/** The shortest plan the server accepts. */
export const minLengthDays = 1;

/** The longest plan the server accepts. */
export const maxLengthDays = 31;

/** An item and a count to put on a planned meal. */
interface LineContent {
  itemId: string;
  count: number;
}

/** Reads the plan, which the server makes and the first pull brings. */
export async function requirePlan(w: Writer): Promise<Plan> {
  const plan = liveRow(await w.get("plan", planId));
  if (!plan) {
    throw new DomainError("The plan has not arrived from the server yet");
  }
  return plan;
}

/** Moves the plan's start date, which relabels every day and moves none. */
export async function setPlanStart(
  w: Writer,
  startDate: string,
): Promise<void> {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    Number.isNaN(Date.parse(startDate))
  ) {
    throw new DomainError(`A start date is yyyy-MM-dd, not ${startDate}`);
  }
  const plan = await requirePlan(w);
  await w.put("plan", { ...plan, startDate });
}

/** Changes the number of days the plan covers by one step, keeping it from 1 to 31. */
export async function adjustPlanLength(
  w: Writer,
  step: CountStep,
): Promise<void> {
  const plan = await requirePlan(w);
  const lengthDays = requireCount(plan.lengthDays + step, minLengthDays);
  if (lengthDays > maxLengthDays) {
    throw new DomainError(`A plan is at most ${maxLengthDays} days`);
  }
  await w.put("plan", { ...plan, lengthDays });
}

/** Refuses a position or rank that is not a whole number of 0 or more. */
function requirePlace(place: number, what: string): number {
  if (!Number.isInteger(place) || place < 0) {
    throw new DomainError(`A ${what} must be a whole number of 0 or more`);
  }
  return place;
}

/** Reads the live planned meals of the day at a position, in their order. */
export async function plannedMealsOn(
  w: Writer,
  position: number,
): Promise<PlannedMeal[]> {
  return (await liveWhere(w, "plannedMeals", "position", position)).sort(
    byPlanOrder,
  );
}

/** Gives each planned meal its place in the list as its rank and the position, writing only those that change. */
async function renumber(
  w: Writer,
  position: number,
  plannedMeals: readonly PlannedMeal[],
): Promise<void> {
  for (const [rank, plannedMeal] of plannedMeals.entries()) {
    if (plannedMeal.rank === rank && plannedMeal.position === position) {
      continue;
    }
    await w.put("plannedMeals", { ...plannedMeal, position, rank });
  }
}

/** Writes a new planned meal at the end of the day's list, with copies of the given lines. */
async function appendPlannedMeal(
  w: Writer,
  position: number,
  name: string,
  mealId: string | null,
  lines: readonly LineContent[],
): Promise<PlannedMeal> {
  const dayMeals = await plannedMealsOn(w, requirePlace(position, "position"));
  const plannedMeal: PlannedMeal = {
    id: newId(),
    revision: 0,
    deletedAt: null,
    position,
    rank: Math.max(-1, ...dayMeals.map((dayMeal) => dayMeal.rank)) + 1,
    name: requireName(name, nameMaxLength),
    mealId,
  };
  await w.put("plannedMeals", plannedMeal);
  await addPlannedMealLines(w, plannedMeal.id, lines);
  return plannedMeal;
}

async function addPlannedMealLines(
  w: Writer,
  plannedMealId: string,
  lines: readonly LineContent[],
): Promise<void> {
  for (const { itemId, count } of lines) {
    await w.put("plannedMealLines", {
      id: newId(),
      revision: 0,
      deletedAt: null,
      plannedMealId,
      itemId,
      count,
    });
  }
}

async function removePlannedMealLines(
  w: Writer,
  plannedMealId: string,
  now: string,
): Promise<void> {
  for (const line of await liveWhere(
    w,
    "plannedMealLines",
    "plannedMealId",
    plannedMealId,
  )) {
    await w.tombstone("plannedMealLines", line.id, now);
  }
}

/** Copies a library meal's name and lines into a new planned meal at the end of the day's list, linked to the meal. */
export async function placeMeal(
  w: Writer,
  position: number,
  mealId: string,
): Promise<PlannedMeal> {
  const meal = await requireLive(w, "meals", mealId);
  const mealLines = await liveWhere(w, "mealLines", "mealId", mealId);
  return appendPlannedMeal(w, position, meal.name, meal.id, mealLines);
}

/** Puts an ad-hoc planned meal at the end of the day's list: a name, no link and no lines. */
export async function placeAdHoc(
  w: Writer,
  position: number,
  name: string,
): Promise<PlannedMeal> {
  return appendPlannedMeal(w, position, name, null, []);
}

/** Renames a planned meal for it only; the library meal and the link stay as they are. */
export async function renamePlannedMeal(
  w: Writer,
  plannedMealId: string,
  name: string,
): Promise<void> {
  const plannedMeal = await requireLive(w, "plannedMeals", plannedMealId);
  await w.put("plannedMeals", {
    ...plannedMeal,
    name: requireName(name, nameMaxLength),
  });
}

/** Sets the count of an item on a planned meal for it only, adding the line when missing and removing it at 0. */
export async function setPlannedMealLine(
  w: Writer,
  plannedMealId: string,
  itemId: string,
  count: number,
  now: string,
): Promise<void> {
  requireCount(count, 0);
  await requireLive(w, "plannedMeals", plannedMealId);
  const lines = await liveWhere(
    w,
    "plannedMealLines",
    "plannedMealId",
    plannedMealId,
  );
  const existingLine = lines.find((line) => line.itemId === itemId);
  if (count === 0) {
    if (existingLine) {
      await w.tombstone("plannedMealLines", existingLine.id, now);
    }
    return;
  }
  if (existingLine) {
    await w.put("plannedMealLines", { ...existingLine, count });
    return;
  }
  await addPlannedMealLines(w, plannedMealId, [{ itemId, count }]);
}

/** Copies the linked meal's current lines back onto the planned meal; does nothing when the meal is gone. */
export async function resetPlannedMeal(
  w: Writer,
  plannedMealId: string,
  now: string,
): Promise<void> {
  const plannedMeal = await requireLive(w, "plannedMeals", plannedMealId);
  const meal = plannedMeal.mealId
    ? liveRow(await w.get("meals", plannedMeal.mealId))
    : undefined;
  if (!meal) {
    return;
  }
  await removePlannedMealLines(w, plannedMeal.id, now);
  await addPlannedMealLines(
    w,
    plannedMeal.id,
    await liveWhere(w, "mealLines", "mealId", meal.id),
  );
}

/** Puts the planned meal into the library as a new meal with its name and lines, and links the planned meal to it. */
export async function savePlannedMealAsMeal(
  w: Writer,
  plannedMealId: string,
): Promise<Meal> {
  const plannedMeal = await requireLive(w, "plannedMeals", plannedMealId);
  const savedMeal = await createMeal(
    w,
    requireName(plannedMeal.name, nameMaxLength),
  );
  for (const { itemId, count } of await liveWhere(
    w,
    "plannedMealLines",
    "plannedMealId",
    plannedMeal.id,
  )) {
    await w.put("mealLines", {
      id: newId(),
      revision: 0,
      deletedAt: null,
      mealId: savedMeal.id,
      itemId,
      count,
    });
  }
  await w.put("plannedMeals", { ...plannedMeal, mealId: savedMeal.id });
  return savedMeal;
}

/** Moves a planned meal to a place in a day's list, its own or another; both days keep their meals numbered from 0 with no gaps, and a place past the end appends. */
export async function movePlannedMeal(
  w: Writer,
  plannedMealId: string,
  toPosition: number,
  toRank: number,
): Promise<void> {
  requirePlace(toPosition, "position");
  requirePlace(toRank, "rank");
  const plannedMeal = await requireLive(w, "plannedMeals", plannedMealId);
  const fromPosition = plannedMeal.position;
  const others = (dayMeals: PlannedMeal[]) =>
    dayMeals.filter((dayMeal) => dayMeal.id !== plannedMeal.id);
  if (fromPosition !== toPosition) {
    await renumber(
      w,
      fromPosition,
      others(await plannedMealsOn(w, fromPosition)),
    );
  }
  const targetMeals = others(await plannedMealsOn(w, toPosition));
  targetMeals.splice(Math.min(toRank, targetMeals.length), 0, plannedMeal);
  await renumber(w, toPosition, targetMeals);
}

/** Removes a planned meal and its lines; the meals after it on its day move up. */
export async function removePlannedMeal(
  w: Writer,
  plannedMealId: string,
  now: string,
): Promise<void> {
  const plannedMeal = await requireLive(w, "plannedMeals", plannedMealId);
  await removePlannedMealLines(w, plannedMeal.id, now);
  await w.tombstone("plannedMeals", plannedMeal.id, now);
  await renumber(
    w,
    plannedMeal.position,
    await plannedMealsOn(w, plannedMeal.position),
  );
}

/** Empties the day at a position: every planned meal on it and their lines are removed. */
export async function clearDay(
  w: Writer,
  position: number,
  now: string,
): Promise<void> {
  for (const plannedMeal of await plannedMealsOn(w, position)) {
    await removePlannedMealLines(w, plannedMeal.id, now);
    await w.tombstone("plannedMeals", plannedMeal.id, now);
  }
}

/** Moves the start date on by the length and removes the Once extras lines; planned meals and Weekly lines stay. */
export async function startNewPlan(w: Writer, now: string): Promise<void> {
  const plan = await requirePlan(w);
  await w.put("plan", { ...plan, startDate: dayDate(plan, plan.lengthDays) });
  for (const line of liveRows(await w.all("wantedLines"))) {
    if (!line.weekly) {
      await w.tombstone("wantedLines", line.id, now);
    }
  }
}

/** Fills each day's list from an archived shop's meals in their order, replacing what was there and clearing the days it does not mention. */
export async function copyMealsFromArchived(
  w: Writer,
  archivedMeals: readonly ShopMeal[],
  now: string,
): Promise<void> {
  const positions = new Set(
    liveRows(await w.all("plannedMeals")).map(
      (plannedMeal) => plannedMeal.position,
    ),
  );
  for (const position of positions) {
    await clearDay(w, position, now);
  }
  for (const archivedMeal of [...archivedMeals].sort(byPlanOrder)) {
    const libraryMeal = archivedMeal.mealId
      ? liveRow(await w.get("meals", archivedMeal.mealId))
      : undefined;
    if (libraryMeal) {
      await placeMeal(w, archivedMeal.position, libraryMeal.id);
      continue;
    }
    await placeAdHoc(w, archivedMeal.position, archivedMeal.name);
  }
}
