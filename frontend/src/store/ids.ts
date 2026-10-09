/** The id of the one plan row, fixed by the server. */
export const planId = "5e1f0a3c-9b2d-4c47-8a61-2f3d4b5c6a70";

const dayIdPrefix = "da7e0000-0000-4000-8000-";

/** Makes a new row id. */
export function newId(): string {
  return crypto.randomUUID();
}

/** Builds a day's id from its position as twelve hex digits in the last group, as the server's Day.IdFor does. */
export function dayIdFor(position: number): string {
  if (!Number.isInteger(position) || position < 0) {
    throw new RangeError(
      `A day position must be a whole number of 0 or more, not ${position}`,
    );
  }
  return dayIdPrefix + position.toString(16).padStart(12, "0");
}
