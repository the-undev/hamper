import { vi } from "vitest";

/** A request the fake fetch received. */
export interface FetchCall {
  method: string;
  path: string;
  body: BodyInit | null;
}

/** Answers a request to one method and path. */
export type FakeRoute = (call: FetchCall) => Response | Promise<Response>;

/** Replaces the global fetch with one that answers "METHOD /path" from the routes, 404 otherwise, and records every call. */
export function fakeFetch(routes: Record<string, FakeRoute>): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const call: FetchCall = {
        method: init?.method ?? "GET",
        path: new URL(String(input), "http://localhost").pathname,
        body: init?.body ?? null,
      };
      calls.push(call);
      const route = routes[`${call.method} ${call.path}`];
      if (!route) {
        return Response.json({ title: "Not found" }, { status: 404 });
      }
      return route(call);
    }),
  );
  return calls;
}
