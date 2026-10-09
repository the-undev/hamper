import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createSyncLoop } from "@/sync/loop";
import { freshDb } from "@/test/db";
import { FakeEventSource } from "@/test/fake-event-source";
import { fakeSyncApi } from "@/test/fake-sync-api";
import { now } from "@/test/rows";
import type { HamperDb } from "./db";
import type { Item } from "./types";
import { write } from "./write";

let db: HamperDb;

beforeEach(() => {
  db = freshDb();
});

afterEach(async () => {
  vi.useRealTimers();
  await db.delete();
});

const milk: Item = {
  id: "a1",
  revision: 0,
  deletedAt: null,
  name: "Milk",
  size: null,
  imageId: null,
};
const bread: Item = {
  id: "b2",
  revision: 0,
  deletedAt: null,
  name: "Bread",
  size: null,
  imageId: null,
};

test("a put stores the row and records one outbox entry", async () => {
  await write(db, (w) => w.put("items", milk));

  expect(await db.items.get("a1")).toEqual(milk);
  const entries = await db.outbox.toArray();
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ table: "items", rowId: "a1" });
});

test("a second put of the same row keeps one entry at its first place and moves dirtiedAt", async () => {
  vi.useFakeTimers({ toFake: ["Date"], now: 1_000 });
  await write(db, (w) => w.put("items", milk));
  await write(db, (w) => w.put("items", bread));
  const [firstEntry] = await db.outbox.toArray();

  await write(db, (w) => w.put("items", { ...milk, name: "Oat milk" }));

  const entries = await db.outbox.orderBy("seq").toArray();
  expect(entries.map((entry) => entry.rowId)).toEqual(["a1", "b2"]);
  expect(entries[0]?.seq).toBe(firstEntry?.seq);
  expect(entries[0]?.dirtiedAt).toBeGreaterThan(
    firstEntry?.dirtiedAt ?? Infinity,
  );
});

test("a throwing fn writes nothing, outbox included", async () => {
  const failing = write(db, async (w) => {
    await w.put("items", milk);
    throw new Error("stop");
  });

  await expect(failing).rejects.toThrow("stop");
  expect(await db.items.count()).toBe(0);
  expect(await db.outbox.count()).toBe(0);
});

test("tombstone sets deletedAt and records the entry", async () => {
  await db.items.put(milk);

  await write(db, (w) =>
    w.tombstone("items", "a1", "2026-06-01T09:00:00.000Z"),
  );

  expect((await db.items.get("a1"))?.deletedAt).toBe(
    "2026-06-01T09:00:00.000Z",
  );
  expect(await db.outbox.toArray()).toMatchObject([
    { table: "items", rowId: "a1" },
  ]);
});

test("where reads rows by foreign key and all reads the whole table", async () => {
  await write(db, async (w) => {
    await w.put("mealLines", {
      id: "l1",
      revision: 0,
      deletedAt: null,
      mealId: "m1",
      itemId: "a1",
      count: 1,
    });
    await w.put("mealLines", {
      id: "l2",
      revision: 0,
      deletedAt: null,
      mealId: "m2",
      itemId: "a1",
      count: 2,
    });
  });

  const [byMeal, everyLine] = await write(db, async (w) => [
    await w.where("mealLines", "mealId", "m2"),
    await w.all("mealLines"),
  ]);

  expect(byMeal.map((line) => line.id)).toEqual(["l2"]);
  expect(everyLine).toHaveLength(2);
});

test("patchFromServer_does_not_touch_the_outbox", async () => {
  await db.items.put(milk);

  await write(db, (w) =>
    w.patchFromServer("items", "a1", { imageId: "new-image" }),
  );

  expect(await db.items.get("a1")).toEqual({ ...milk, imageId: "new-image" });
  expect(await db.outbox.count()).toBe(0);
});

test("patchFromServer_is_carried_by_a_pending_push", async () => {
  await write(db, (w) => w.put("items", { ...milk, name: "Whole milk" }));
  const [entryBefore] = await db.outbox.toArray();

  await write(db, (w) =>
    w.patchFromServer("items", "a1", { imageId: "new-image" }),
  );

  expect(await db.outbox.toArray()).toEqual([entryBefore]);
  const api = fakeSyncApi();
  const loop = createSyncLoop({
    db,
    api,
    events: () => new FakeEventSource("/sync/events"),
    now: () => now,
    online: () => true,
  });
  await loop.syncNow();
  expect(api.pushes[0]?.map((change) => change.row)).toEqual([
    {
      id: "a1",
      deletedAt: null,
      name: "Whole milk",
      size: null,
      imageId: "new-image",
    },
  ]);
});
