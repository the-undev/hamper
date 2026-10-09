import { afterEach, expect, test, vi } from "vitest";
import { FakeEventSource } from "@/test/fake-event-source";
import { noRows } from "@/test/fake-sync-api";
import { openEvents, pull, push, SyncError, SyncUnreachableError } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  FakeEventSource.reset();
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const milkRow = {
  id: "a1",
  deletedAt: null,
  name: "Milk",
  size: null,
  imageId: null,
};

test("pull_asks_for_the_rows_above_the_cursor_and_returns_them", async () => {
  const body = {
    ...noRows(),
    revision: 42,
    items: [{ ...milkRow, revision: 41 }],
  };
  const fetchMock = stubFetch(Response.json(body));

  const pulled = await pull(40);

  expect(fetchMock).toHaveBeenCalledWith("/sync?since=40", { method: "GET" });
  expect(pulled).toEqual(body);
});

test("push_posts_the_changes_as_json_and_returns_the_response", async () => {
  const body = {
    revision: 7,
    applied: ["3"],
    rows: { ...noRows(), items: [{ ...milkRow, revision: 7 }] },
  };
  const fetchMock = stubFetch(Response.json(body));

  const pushed = await push([{ id: "3", table: "items", row: milkRow }]);

  const [url, init] = fetchMock.mock.calls[0] ?? [];
  expect(url).toBe("/sync");
  expect(init?.method).toBe("POST");
  expect(new Headers(init?.headers).get("Content-Type")).toBe(
    "application/json",
  );
  expect(JSON.parse(String(init?.body))).toEqual({
    changes: [{ id: "3", table: "items", row: milkRow }],
  });
  expect(pushed).toEqual(body);
});

test("a_400_becomes_a_sync_error_with_the_problem_title", async () => {
  stubFetch(
    Response.json(
      {
        title: "Push rejected",
        detail: "Change 3: count is below 1",
        status: 400,
      },
      { status: 400, headers: { "Content-Type": "application/problem+json" } },
    ),
  );

  const failure = await push([{ id: "3", table: "items", row: milkRow }]).catch(
    (error: unknown) => error,
  );

  expect(failure).toBeInstanceOf(SyncError);
  expect(failure).toMatchObject({
    status: 400,
    title: "Push rejected",
    detail: "Change 3: count is below 1",
  });
});

test("a_failed_request_becomes_unreachable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")),
  );

  await expect(pull(0)).rejects.toBeInstanceOf(SyncUnreachableError);
});

test("events_open_the_revision_stream", () => {
  vi.stubGlobal("EventSource", FakeEventSource);

  openEvents();

  expect(FakeEventSource.instances.map((source) => source.url)).toEqual([
    "/sync/events",
  ]);
});
