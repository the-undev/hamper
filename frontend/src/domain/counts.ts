import type { Writer } from "@/store/write";
import { requireCount, requireLive } from "./checks";

/** One more or one fewer, as + and − give. */
export type CountStep = 1 | -1;

/** The tables whose rows are lines with a count. */
export type LineTable =
  | "plannedMealLines"
  | "mealLines"
  | "wantedLines"
  | "shopLines";

/** Changes a line's stored count by one step, refusing a count below 1; the row still pushes the count it ends on. */
export async function adjustLineCount(
  w: Writer,
  table: LineTable,
  lineId: string,
  step: CountStep,
): Promise<void> {
  const line = await requireLive(w, table, lineId);
  await w.put(table, { ...line, count: requireCount(line.count + step, 1) });
}
