import { liveRows } from "@/store/live";
import type { SyncTable, TableRows } from "@/store/types";
import type { IndexedKey, Writer } from "@/store/write";

/** An operation refused because it would break a rule of the domain. */
export class DomainError extends Error {
  override name = "DomainError";
}

/** The longest item, meal or planned meal name the server accepts. */
export const nameMaxLength = 200;

/** The longest item size the server accepts. */
export const sizeMaxLength = 100;

/** Trims a name and refuses one that is empty or over the maximum. */
export function requireName(name: string, maxLength: number | null): string {
  const trimmedName = name.trim();
  if (trimmedName === "") {
    throw new DomainError("A name cannot be empty");
  }
  if (maxLength !== null && trimmedName.length > maxLength) {
    throw new DomainError(`A name cannot be over ${maxLength} characters`);
  }
  return trimmedName;
}

/** Trims optional text to null when empty and refuses it over the maximum. */
export function optionalText(
  text: string | null,
  maxLength: number | null,
): string | null {
  const trimmedText = text?.trim() ?? "";
  if (trimmedText === "") {
    return null;
  }
  if (maxLength !== null && trimmedText.length > maxLength) {
    throw new DomainError(`The text cannot be over ${maxLength} characters`);
  }
  return trimmedText;
}

/** Refuses a count that is not a whole number of at least the minimum. */
export function requireCount(count: number, minimum: number): number {
  if (!Number.isInteger(count) || count < minimum) {
    throw new DomainError(
      `A count must be a whole number of at least ${minimum}`,
    );
  }
  return count;
}

/** Reads a live row by id, refusing a missing or tombstoned one. */
export async function requireLive<T extends SyncTable>(
  w: Writer,
  table: T,
  id: string,
): Promise<TableRows[T]> {
  const row = await w.get(table, id);
  if (!row || row.deletedAt !== null) {
    throw new DomainError(`No live ${table} row ${id}`);
  }
  return row;
}

/** Reads the live rows whose indexed column holds the value. */
export async function liveWhere<T extends SyncTable>(
  w: Writer,
  table: T,
  key: IndexedKey<T>,
  value: string | number,
): Promise<TableRows[T][]> {
  return liveRows(await w.where(table, key, value));
}
