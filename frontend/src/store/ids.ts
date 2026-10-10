/** The id of the one plan row, fixed by the server. */
export const planId = "5e1f0a3c-9b2d-4c47-8a61-2f3d4b5c6a70";

/** Makes a new row id. */
export function newId(): string {
  return crypto.randomUUID();
}
