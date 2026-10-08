import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { HamperDb } from "@/store/db";
import type { Item } from "@/store/types";
import { write } from "@/store/write";
import { freshDb } from "@/test/db";
import { FakeEventSource } from "@/test/fake-event-source";
import { type FakeSyncApi, fakeSyncApi, noRows } from "@/test/fake-sync-api";
import { anItem } from "@/test/rows";
import { SyncError, SyncUnreachableError } from "./api";
import { createSyncLoop, type SyncLoop } from "./loop";

let db: HamperDb;
let api: FakeSyncApi;
let loop: SyncLoop;

const syncedAt = "2026-06-01T09:00:00.000Z";
const milk = anItem("Milk");
const bread = anItem("Bread");

beforeEach(() => {
  db = freshDb();
  api = fakeSyncApi();
  loop = createSyncLoop({
    db,
    api,
    events: () => new FakeEventSource("/sync/events"),
    now: () => syncedAt,
    online: () => true,
  });
});

afterEach(async () => {
  loop.stop();
  FakeEventSource.reset();
  await db.delete();
});

function events(): FakeEventSource {
  const source = FakeEventSource.instances[0];
  if (!source) {
    throw new Error("The loop has not opened the event stream");
  }
  return source;
}

async function putItems(...items: Item[]): Promise<void> {
  await write(db, async (w) => {
    for (const item of items) {
      await w.put("items", item);
    }
  });
}

/** Lets every pending promise and Dexie request settle. */
async function settle(): Promise<void> {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

test("push_sends_every_outbox_entry_as_a_whole_row_in_seq_order", async () => {
  await putItems(milk);
  await putItems(bread);
  await putItems({ ...milk, name: "Oat milk" });
  const entries = await db.outbox.orderBy("seq").toArray();

  await loop.syncNow();

  expect(api.pushes).toEqual([
    [
      {
        id: String(entries[0]?.seq),
        table: "items",
        row: {
          id: milk.id,
          deletedAt: null,
          name: "Oat milk",
          size: null,
          imageId: null,
        },
      },
      {
        id: String(entries[1]?.seq),
        table: "items",
        row: {
          id: bread.id,
          deletedAt: null,
          name: "Bread",
          size: null,
          imageId: null,
        },
      },
    ],
  ]);
});

test("push_clears_applied_entries_and_keeps_ones_dirtied_meanwhile", async () => {
  await putItems(milk, bread);
  const defaultPush = api.onPush;
  api.onPush = async (changes) => {
    await putItems({ ...bread, name: "Brown bread" });
    return defaultPush(changes);
  };

  await loop.syncNow();

  expect((await db.outbox.toArray()).map((entry) => entry.rowId)).toEqual([
    bread.id,
  ]);
});

test("push_upserts_returned_rows_except_ones_still_dirty", async () => {
  await putItems(milk, bread);
  api.onPush = async (changes) => {
    await putItems({ ...bread, name: "Brown bread" });
    return {
      revision: 12,
      applied: changes.map((change) => change.id),
      rows: {
        ...noRows(),
        items: [
          { ...milk, revision: 11 },
          { ...bread, revision: 12 },
        ],
      },
    };
  };

  await loop.syncNow();

  expect(await db.items.get(milk.id)).toMatchObject({ revision: 11 });
  expect(await db.items.get(bread.id)).toMatchObject({
    name: "Brown bread",
    revision: 0,
  });
});

test("pull_skips_rows_that_are_dirty_locally", async () => {
  await putItems({ ...milk, name: "Oat milk" });
  api.onPush = async () => {
    throw new SyncError(400, "Push rejected", null);
  };
  api.onPull = async () => ({
    ...noRows(),
    revision: 20,
    items: [
      { ...milk, revision: 19 },
      { ...bread, revision: 20 },
    ],
  });

  await loop.syncNow();

  expect(await db.items.get(milk.id)).toMatchObject({
    name: "Oat milk",
    revision: 0,
  });
  expect(await db.items.get(bread.id)).toMatchObject({
    name: "Bread",
    revision: 20,
  });
});

test("pull_stores_the_cursor", async () => {
  api.onPull = async () => ({ ...noRows(), revision: 42 });

  await loop.syncNow();
  await loop.syncNow();

  expect(await db.meta.get("cursor")).toEqual({ key: "cursor", value: 42 });
  expect(api.pulls).toEqual([0, 42]);
});

test("a_revision_event_above_the_cursor_triggers_a_pull", async () => {
  await db.meta.put({ key: "cursor", value: 10 });
  loop.start();

  events().emit("revision", 11);

  await vi.waitFor(() => expect(api.pulls).toEqual([10]));
});

test("a_revision_event_at_or_below_the_cursor_does_nothing", async () => {
  await db.meta.put({ key: "cursor", value: 10 });
  loop.start();

  events().emit("revision", 10);
  events().emit("revision", 9);
  await settle();

  expect(api.pulls).toEqual([]);
});

test("opening_the_event_stream_syncs_and_an_error_on_it_marks_offline", async () => {
  loop.start();

  events().open();
  await vi.waitFor(() => expect(api.pulls).toEqual([0]));
  events().fail();

  expect(loop.status.get().online).toBe(false);
});

test("the_browser_coming_online_or_into_focus_syncs", async () => {
  loop.start();

  window.dispatchEvent(new Event("online"));
  await vi.waitFor(() => expect(api.pulls).toHaveLength(1));
  window.dispatchEvent(new Event("focus"));

  await vi.waitFor(() => expect(api.pulls).toHaveLength(2));
});

test("a_network_failure_marks_offline_and_keeps_the_outbox", async () => {
  await putItems(milk);
  api.onPush = async () => {
    throw new SyncUnreachableError("Could not reach /sync");
  };

  await loop.syncNow();

  expect(loop.status.get().online).toBe(false);
  expect(await db.outbox.count()).toBe(1);
  expect(api.pulls).toEqual([]);
});

test("a_400_keeps_the_outbox_and_reports_the_title", async () => {
  await putItems(milk);
  api.onPush = async () => {
    throw new SyncError(400, "Push rejected", "Change 1: count is below 1");
  };

  await loop.syncNow();

  expect(loop.status.get()).toMatchObject({
    online: true,
    lastError: "Push rejected",
  });
  expect(await db.outbox.count()).toBe(1);
});

test("a_clean_sync_clears_the_error_and_records_when", async () => {
  await putItems(milk);
  api.onPush = async () => {
    throw new SyncError(400, "Push rejected", null);
  };
  await loop.syncNow();
  api.onPush = fakeSyncApi().onPush;

  await loop.syncNow();

  expect(loop.status.get()).toMatchObject({
    lastError: null,
    lastSyncAt: syncedAt,
  });
});

test("syncNow_while_running_queues_one_rerun", async () => {
  let releasePull = (): void => {};
  api.onPull = (since) =>
    new Promise((resolve) => {
      releasePull = () => resolve({ ...noRows(), revision: since });
    });

  const firstRun = loop.syncNow();
  await vi.waitFor(() => expect(api.pulls).toHaveLength(1));
  const secondRun = loop.syncNow();
  const thirdRun = loop.syncNow();
  releasePull();
  await vi.waitFor(() => expect(api.pulls).toHaveLength(2));
  releasePull();
  await Promise.all([firstRun, secondRun, thirdRun]);

  expect(api.pulls).toHaveLength(2);
});

test("status_pending_tracks_the_outbox_count", async () => {
  loop.start();

  await putItems(milk, bread);
  await vi.waitFor(() => expect(loop.status.get().pending).toBe(2));
  await loop.syncNow();

  await vi.waitFor(() => expect(loop.status.get().pending).toBe(0));
});

test("a_local_write_pushes_after_a_moment", async () => {
  loop.start();

  await putItems(milk);
  await settle();
  expect(api.pushes).toEqual([]);

  await vi.waitFor(() => expect(api.pushes).toHaveLength(1));
  expect(api.pushes[0]?.[0]?.row).toMatchObject({ id: milk.id });
});

test("a_burst_of_writes_pushes_once", async () => {
  loop.start();

  await putItems(milk);
  await putItems(bread);
  await putItems({ ...milk, name: "Oat milk" });
  await vi.waitFor(() => expect(api.pushes).toHaveLength(1));
  await new Promise((resolve) => setTimeout(resolve, 500));

  expect(api.pushes).toHaveLength(1);
  expect(api.pushes[0]).toHaveLength(2);
});

test("an_edit_to_a_row_already_waiting_pushes_again", async () => {
  const defaultPush = api.onPush;
  let releasePush = (): void => {};
  let firstPushStarted = false;
  api.onPush = async (changes) => {
    if (firstPushStarted) {
      return defaultPush(changes);
    }
    firstPushStarted = true;
    await new Promise<void>((resolve) => {
      releasePush = resolve;
    });
    return defaultPush(changes);
  };
  loop.start();

  await putItems(milk);
  await vi.waitFor(() => expect(api.pushes).toHaveLength(1));
  await putItems({ ...milk, name: "Oat milk" });
  await settle();
  releasePush();

  await vi.waitFor(() => expect(api.pushes).toHaveLength(2));
  expect(api.pushes[1]?.[0]?.row).toMatchObject({
    id: milk.id,
    name: "Oat milk",
  });
});

test("a_write_while_offline_waits_for_the_online_event", async () => {
  api.onPush = async () => {
    throw new SyncUnreachableError("Could not reach /sync");
  };
  loop.start();
  await putItems(milk);
  await vi.waitFor(() => expect(loop.status.get().online).toBe(false));
  api.onPush = fakeSyncApi().onPush;

  await putItems(bread);
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(api.pushes).toHaveLength(1);

  window.dispatchEvent(new Event("online"));
  await vi.waitFor(() => expect(api.pushes).toHaveLength(2));
});

test("a_refused_batch_does_not_push_again_until_the_next_write", async () => {
  api.onPush = async () => {
    throw new SyncError(400, "Push rejected", null);
  };
  loop.start();

  await putItems(milk);
  await vi.waitFor(() => expect(api.pushes).toHaveLength(1));
  await new Promise((resolve) => setTimeout(resolve, 600));
  expect(api.pushes).toHaveLength(1);

  await putItems(bread);
  await vi.waitFor(() => expect(api.pushes).toHaveLength(2));
});

test("stop_closes_the_event_stream", () => {
  loop.start();

  loop.stop();

  expect(events().closed).toBe(true);
});
