import { dayIdFor, newId, planId } from "@/store/ids";
import { liveRow, liveRows } from "@/store/live";
import type { Day, Meal, Plan, ShopMeal } from "@/store/types";
import type { Writer } from "@/store/write";
import {
  DomainError,
  liveWhere,
  nameMaxLength,
  requireCount,
  requireLive,
  requireName,
} from "./checks";
import { dayDate } from "./display";
import { createMeal } from "./meals";

/** The shortest plan the server accepts. */
export const minLengthDays = 1;

/** The longest plan the server accepts. */
export const maxLengthDays = 31;

/** An item and a count to put on a day. */
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

/** Sets the number of days the plan covers, from 1 to 31. */
export async function setPlanLength(
  w: Writer,
  lengthDays: number,
): Promise<void> {
  requireCount(lengthDays, minLengthDays);
  if (lengthDays > maxLengthDays) {
    throw new DomainError(`A plan is at most ${maxLengthDays} days`);
  }
  const plan = await requirePlan(w);
  await w.put("plan", { ...plan, lengthDays });
}

/** Reads the day at a position when it holds a planned meal. */
export async function liveDay(
  w: Writer,
  position: number,
): Promise<Day | undefined> {
  return liveRow(await w.get("days", dayIdFor(position)));
}

/** Writes the day at a position with a name and link, replacing its lines with copies of the given ones. */
async function fillDay(
  w: Writer,
  position: number,
  name: string,
  mealId: string | null,
  lines: readonly LineContent[],
  now: string,
): Promise<void> {
  const dayId = dayIdFor(position);
  const storedDay = await w.get("days", dayId);
  await w.put("days", {
    id: dayId,
    revision: storedDay?.revision ?? 0,
    deletedAt: null,
    position,
    name: requireName(name, null),
    mealId,
  });
  await replaceDayLines(w, dayId, lines, now);
}

async function replaceDayLines(
  w: Writer,
  dayId: string,
  lines: readonly LineContent[],
  now: string,
): Promise<void> {
  for (const oldLine of await liveWhere(w, "dayLines", "dayId", dayId)) {
    await w.tombstone("dayLines", oldLine.id, now);
  }
  for (const { itemId, count } of lines) {
    await w.put("dayLines", {
      id: newId(),
      revision: 0,
      deletedAt: null,
      dayId,
      itemId,
      count,
    });
  }
}

/** Copies a library meal's name and lines onto the day at a position and links the day to it. */
export async function placeMeal(
  w: Writer,
  position: number,
  mealId: string,
  now: string,
): Promise<void> {
  const meal = await requireLive(w, "meals", mealId);
  const mealLines = await liveWhere(w, "mealLines", "mealId", mealId);
  await fillDay(w, position, meal.name, meal.id, mealLines, now);
}

/** Makes the day at a position an ad-hoc day: a name, no link and no lines. */
export async function placeAdHoc(
  w: Writer,
  position: number,
  name: string,
  now: string,
): Promise<void> {
  await fillDay(w, position, name, null, [], now);
}

/** Sets the count of an item on a day for that day only, adding the line when missing and removing it at 0. */
export async function setDayLine(
  w: Writer,
  position: number,
  itemId: string,
  count: number,
  now: string,
): Promise<void> {
  requireCount(count, 0);
  const day = await liveDay(w, position);
  if (!day) {
    throw new DomainError(`Day ${position} holds no planned meal`);
  }
  const dayLines = await liveWhere(w, "dayLines", "dayId", day.id);
  const existingLine = dayLines.find((line) => line.itemId === itemId);
  if (count === 0) {
    if (existingLine) {
      await w.tombstone("dayLines", existingLine.id, now);
    }
    return;
  }
  if (existingLine) {
    await w.put("dayLines", { ...existingLine, count });
    return;
  }
  await w.put("dayLines", {
    id: newId(),
    revision: 0,
    deletedAt: null,
    dayId: day.id,
    itemId,
    count,
  });
}

/** Copies the linked meal's current lines back onto the day; does nothing when the meal is gone. */
export async function resetDay(
  w: Writer,
  position: number,
  now: string,
): Promise<void> {
  const day = await liveDay(w, position);
  if (!day?.mealId) {
    return;
  }
  const meal = liveRow(await w.get("meals", day.mealId));
  if (!meal) {
    return;
  }
  const mealLines = await liveWhere(w, "mealLines", "mealId", meal.id);
  await replaceDayLines(w, day.id, mealLines, now);
}

/** Puts the day into the library as a new meal with its name and lines, and links the day to it. */
export async function saveDayAsMeal(
  w: Writer,
  position: number,
): Promise<Meal> {
  const day = await liveDay(w, position);
  if (!day) {
    throw new DomainError(`Day ${position} holds no planned meal`);
  }
  const savedMeal = await createMeal(w, requireName(day.name, nameMaxLength));
  for (const { itemId, count } of await liveWhere(
    w,
    "dayLines",
    "dayId",
    day.id,
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
  await w.put("days", { ...day, mealId: savedMeal.id });
  return savedMeal;
}

/** Swaps two days' names, links and lines; a day swapped with an empty one becomes empty. */
export async function swapDays(
  w: Writer,
  firstPosition: number,
  secondPosition: number,
  now: string,
): Promise<void> {
  if (firstPosition === secondPosition) {
    return;
  }
  const firstDay = await liveDay(w, firstPosition);
  const secondDay = await liveDay(w, secondPosition);
  const firstLines = firstDay
    ? await liveWhere(w, "dayLines", "dayId", firstDay.id)
    : [];
  const secondLines = secondDay
    ? await liveWhere(w, "dayLines", "dayId", secondDay.id)
    : [];

  await takeDayContent(w, secondPosition, firstDay, now);
  await takeDayContent(w, firstPosition, secondDay, now);
  for (const line of firstLines) {
    await w.put("dayLines", { ...line, dayId: dayIdFor(secondPosition) });
  }
  for (const line of secondLines) {
    await w.put("dayLines", { ...line, dayId: dayIdFor(firstPosition) });
  }
}

/** Gives the day at a position another day's name and link, or empties it when there is no other day. */
async function takeDayContent(
  w: Writer,
  position: number,
  sourceDay: Day | undefined,
  now: string,
): Promise<void> {
  const dayId = dayIdFor(position);
  const storedDay = await w.get("days", dayId);
  if (!sourceDay) {
    if (storedDay?.deletedAt === null) {
      await w.tombstone("days", dayId, now);
    }
    return;
  }
  await w.put("days", {
    id: dayId,
    revision: storedDay?.revision ?? 0,
    deletedAt: null,
    position,
    name: sourceDay.name,
    mealId: sourceDay.mealId,
  });
}

/** Empties the day at a position: the day and its lines are removed. */
export async function clearDay(
  w: Writer,
  position: number,
  now: string,
): Promise<void> {
  const day = await liveDay(w, position);
  if (!day) {
    return;
  }
  for (const line of await liveWhere(w, "dayLines", "dayId", day.id)) {
    await w.tombstone("dayLines", line.id, now);
  }
  await w.tombstone("days", day.id, now);
}

/** Moves the start date on by the length and removes the Once wanted lines; days and Weekly lines stay. */
export async function startNewPlan(w: Writer, now: string): Promise<void> {
  const plan = await requirePlan(w);
  await w.put("plan", { ...plan, startDate: dayDate(plan, plan.lengthDays) });
  for (const line of liveRows(await w.all("wantedLines"))) {
    if (!line.weekly) {
      await w.tombstone("wantedLines", line.id, now);
    }
  }
}

/** Fills the days by position from an archived shop's meals, replacing what was there and clearing days it does not mention. */
export async function copyMealsFromArchived(
  w: Writer,
  archivedMeals: readonly ShopMeal[],
  now: string,
): Promise<void> {
  const archivedPositions = new Set(
    archivedMeals.map((archivedMeal) => archivedMeal.position),
  );
  for (const day of liveRows(await w.all("days"))) {
    if (!archivedPositions.has(day.position)) {
      await clearDay(w, day.position, now);
    }
  }
  for (const archivedMeal of archivedMeals) {
    const libraryMeal = archivedMeal.mealId
      ? liveRow(await w.get("meals", archivedMeal.mealId))
      : undefined;
    if (libraryMeal) {
      await placeMeal(w, archivedMeal.position, libraryMeal.id, now);
      continue;
    }
    await placeAdHoc(w, archivedMeal.position, archivedMeal.name, now);
  }
}
