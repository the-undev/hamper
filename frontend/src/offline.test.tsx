import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { HamperDb } from "@/store/db";
import { type PushChange, syncApi } from "@/sync/api";
import { createSyncLoop, type SyncLoop } from "@/sync/loop";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { FakeEventSource } from "@/test/fake-event-source";
import { fakeFetch } from "@/test/fake-fetch";
import { noRows } from "@/test/fake-sync-api";
import {
  aDay,
  aMeal,
  anItem,
  aShop,
  aShopLine,
  now,
  seed,
  thePlan,
} from "@/test/rows";

let db: HamperDb;
let loop: SyncLoop;

const milk = anItem("Milk");
const curry = aMeal("Curry");
const shop = aShop("Corner shop");
const milkLine = aShopLine(shop, milk, 2);
const offline = "Offline. Changes are kept on this phone.";

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [milk],
    meals: [curry],
    plan: [thePlan("2026-06-01", 7)],
    days: [aDay(0, "Curry", curry)],
    shops: [shop],
    shopLines: [milkLine],
  });
  loop = createSyncLoop({
    db,
    api: syncApi,
    events: () => new FakeEventSource("/sync/events"),
    now: () => now,
    online: () => true,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

test("with_no_server_the_plan_and_the_shop_render_from_the_store_and_the_bar_says_offline", async () => {
  const { router } = renderApp("/plan", db, loop);
  await act(() => loop.syncNow());

  expect((await screen.findAllByText("Curry")).length).toBeGreaterThan(0);
  expect(screen.getByText(offline)).toBeInTheDocument();

  await act(() =>
    router.navigate({ to: "/shop/$shopId", params: { shopId: shop.id } }),
  );

  expect(
    await screen.findByRole("checkbox", { name: "Milk in the trolley" }),
  ).toBeInTheDocument();
  expect(screen.getByText(offline)).toBeInTheDocument();
});

test("an_edit_made_with_no_server_waits_in_the_outbox_and_is_pushed_when_the_server_answers", async () => {
  const { user } = renderApp(`/shop/${shop.id}`, db, loop);
  await act(() => loop.syncNow());
  expect(await screen.findByText(offline)).toBeInTheDocument();

  await user.click(
    await screen.findByRole("checkbox", { name: "Milk in the trolley" }),
  );
  await waitFor(async () => expect(await db.outbox.count()).toBe(1));
  await act(() => loop.syncNow());
  expect(await db.outbox.count()).toBe(1);

  const pushes: PushChange[][] = [];
  fakeFetch({
    "POST /sync": (call) => {
      const { changes } = JSON.parse(String(call.body)) as {
        changes: PushChange[];
      };
      pushes.push(changes);
      return Response.json({
        revision: 1,
        applied: changes.map((change) => change.id),
        rows: noRows(),
      });
    },
    "GET /sync": () => Response.json({ ...noRows(), revision: 1 }),
  });
  await act(() => loop.syncNow());

  expect(pushes).toHaveLength(1);
  expect(pushes[0]?.[0]).toMatchObject({
    table: "shopLines",
    row: { id: milkLine.id, ticked: true },
  });
  expect(await db.outbox.count()).toBe(0);
  await waitFor(() =>
    expect(screen.queryByText(offline)).not.toBeInTheDocument(),
  );
});
