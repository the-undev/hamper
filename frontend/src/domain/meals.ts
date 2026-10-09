import { newId } from "@/store/ids";
import type { Meal } from "@/store/types";
import type { Writer } from "@/store/write";
import {
  liveWhere,
  nameMaxLength,
  requireCount,
  requireLive,
  requireName,
} from "./checks";

/** Adds a meal with no lines to the library. */
export async function createMeal(w: Writer, name: string): Promise<Meal> {
  const createdMeal: Meal = {
    id: newId(),
    revision: 0,
    deletedAt: null,
    name: requireName(name, nameMaxLength),
    imageId: null,
  };
  await w.put("meals", createdMeal);
  return createdMeal;
}

/** Renames a library meal; days already planned keep the name they copied. */
export async function renameMeal(
  w: Writer,
  mealId: string,
  name: string,
): Promise<void> {
  const meal = await requireLive(w, "meals", mealId);
  await w.put("meals", { ...meal, name: requireName(name, nameMaxLength) });
}

/** Sets the count of an item on a meal, adding the line when missing and removing it at 0. */
export async function setMealLine(
  w: Writer,
  mealId: string,
  itemId: string,
  count: number,
  now: string,
): Promise<void> {
  requireCount(count, 0);
  await requireLive(w, "meals", mealId);
  const mealLines = await liveWhere(w, "mealLines", "mealId", mealId);
  const existingLine = mealLines.find((line) => line.itemId === itemId);
  if (count === 0) {
    if (existingLine) {
      await w.tombstone("mealLines", existingLine.id, now);
    }
    return;
  }
  if (existingLine) {
    await w.put("mealLines", { ...existingLine, count });
    return;
  }
  await requireLive(w, "items", itemId);
  await w.put("mealLines", {
    id: newId(),
    revision: 0,
    deletedAt: null,
    mealId,
    itemId,
    count,
  });
}

/** Copies a meal and its lines into a new library meal named as a copy. */
export async function duplicateMeal(w: Writer, mealId: string): Promise<Meal> {
  const sourceMeal = await requireLive(w, "meals", mealId);
  const copiedMeal = await createMeal(w, `${sourceMeal.name} (copy)`);
  for (const line of await liveWhere(w, "mealLines", "mealId", mealId)) {
    await w.put("mealLines", {
      ...line,
      id: newId(),
      revision: 0,
      mealId: copiedMeal.id,
    });
  }
  return copiedMeal;
}

/** Removes a meal and its lines; days copied from it keep their copy and their link. */
export async function deleteMeal(
  w: Writer,
  mealId: string,
  now: string,
): Promise<void> {
  await requireLive(w, "meals", mealId);
  for (const line of await liveWhere(w, "mealLines", "mealId", mealId)) {
    await w.tombstone("mealLines", line.id, now);
  }
  await w.tombstone("meals", mealId, now);
}
