import type { ShopMeal } from "@/store/types";
import { readProblem } from "@/sync/api";

/** A REST call failed; the title is the server's problem title, or says the server could not be reached. */
export class RestError extends Error {
  override name = "RestError";
  readonly status: number;
  readonly title: string;

  constructor(status: number, title: string) {
    super(title);
    this.status = status;
    this.title = title;
  }
}

/** An archived shop as the history list shows it, with a count in place of its lines. */
export interface HistoryEntry {
  id: string;
  name: string;
  createdAt: string;
  archivedAt: string;
  planStartDate: string | null;
  planLengthDays: number | null;
  meals: ShopMeal[];
  lineCount: number;
}

/** A shop line as text, as it showed when the shop was archived. */
export interface ArchivedLine {
  name: string;
  size: string | null;
  count: number;
  sources: string[];
  ticked: boolean;
}

/** An archived shop in full. */
export type ArchivedShop = Omit<HistoryEntry, "lineCount"> & {
  lines: ArchivedLine[];
};

async function send(url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new RestError(0, "The server could not be reached");
  }
  if (!response.ok) {
    const problem = await readProblem(response);
    throw new RestError(response.status, problem.title);
  }
  return response;
}

/** Moves an open shop to history on the server, which tombstones it. */
export async function archiveShop(shopId: string): Promise<void> {
  await send(`/api/shops/${shopId}/archive`, { method: "POST" });
}

/** Reads the archived shops, newest first. */
export async function fetchHistory(): Promise<HistoryEntry[]> {
  const response = await send("/api/history", { method: "GET" });
  return (await response.json()) as HistoryEntry[];
}

/** Reads one archived shop with its lines. */
export async function fetchArchivedShop(id: string): Promise<ArchivedShop> {
  const response = await send(`/api/history/${id}`, { method: "GET" });
  return (await response.json()) as ArchivedShop;
}

/** Sends an export zip to an empty instance. */
export async function importExport(zip: Blob): Promise<void> {
  await send("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: zip,
  });
}

/** The query key of the history list; archiving invalidates it. */
export const historyKey = ["history"] as const;
