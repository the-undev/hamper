import type { SyncTable, TableRowLists, TableRows } from "@/store/types";

/** A row as a push sends it: every column but the revision. */
export type WireRow = {
  [T in SyncTable]: Omit<TableRows[T], "revision">;
}[SyncTable];

/** One outbox entry sent to the server, under the client's change id. */
export interface PushChange {
  id: string;
  table: SyncTable;
  row: WireRow;
}

/** The server's current revision and every row written after the cursor. */
export type PullResponse = TableRowLists & { revision: number };

/** The revision after a push, the applied change ids, and the pushed rows as they now stand. */
export interface PushResponse {
  revision: number;
  applied: string[];
  rows: TableRowLists;
}

/** The sync endpoints the loop calls. */
export interface SyncApi {
  /** Reads every row written after the cursor. */
  pull(since: number): Promise<PullResponse>;
  /** Sends a batch of whole-row changes. */
  push(changes: PushChange[]): Promise<PushResponse>;
}

/** The stream of revision events, as much of EventSource as the loop uses. */
export interface RevisionEvents {
  /** Listens for `open`, `error` and `revision` events. */
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  /** Closes the stream. */
  close(): void;
}

/** The server answered with an error status; the title and detail come from its problem body. */
export class SyncError extends Error {
  override name = "SyncError";
  readonly status: number;
  readonly title: string;
  readonly detail: string | null;

  constructor(status: number, title: string, detail: string | null) {
    super(detail ? `${title}: ${detail}` : title);
    this.status = status;
    this.title = title;
    this.detail = detail;
  }
}

/** The request never reached the server or got no answer. */
export class SyncUnreachableError extends Error {
  override name = "SyncUnreachableError";
}

/** Reads every row written after the cursor. */
export async function pull(since: number): Promise<PullResponse> {
  return readJson<PullResponse>(
    await send(`/sync?since=${since}`, { method: "GET" }),
  );
}

/** Sends a batch of whole-row changes in one request. */
export async function push(changes: PushChange[]): Promise<PushResponse> {
  const response = await send("/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changes }),
  });
  return readJson<PushResponse>(response);
}

/** Opens the server-sent event stream of revisions. */
export function openEvents(): RevisionEvents {
  return new EventSource("/sync/events");
}

/** The sync endpoints over fetch. */
export const syncApi: SyncApi = { pull, push };

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new SyncUnreachableError(`Could not reach ${url}`, { cause: error });
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }
  const problem = await readProblem(response);
  throw new SyncError(response.status, problem.title, problem.detail);
}

/** Reads the title and detail of a problem+json body, falling back to the status text. */
export async function readProblem(
  response: Response,
): Promise<{ title: string; detail: string | null }> {
  const fallbackTitle = response.statusText || `HTTP ${response.status}`;
  try {
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null) {
      return { title: fallbackTitle, detail: null };
    }
    const title =
      "title" in body && typeof body.title === "string"
        ? body.title
        : fallbackTitle;
    const detail =
      "detail" in body && typeof body.detail === "string" ? body.detail : null;
    return { title, detail };
  } catch {
    return { title: fallbackTitle, detail: null };
  }
}
