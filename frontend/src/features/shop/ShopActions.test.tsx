import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { HamperDb } from "@/store/db";
import { createSyncLoop } from "@/sync/loop";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { FakeEventSource } from "@/test/fake-event-source";
import { fakeFetch } from "@/test/fake-fetch";
import { fakeLoop, quietStatus } from "@/test/fake-loop";
import { fakeSyncApi, noRows } from "@/test/fake-sync-api";
import {
  anItem,
  aShop,
  aShopLine,
  live,
  now,
  seed,
  thePlan,
} from "@/test/rows";

let db: HamperDb;

const milk = anItem("Milk", "4 pints");
const rice = anItem("Rice");
const shop = aShop("Corner shop");
const milkLine = aShopLine(shop, milk, 2);
const riceLine = { ...aShopLine(shop, rice, 1), ticked: true };

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [milk, rice],
    plan: [thePlan()],
    shops: [shop],
    shopLines: [milkLine, riceLine],
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await db.delete();
});

test("share_copies_the_unticked_lines_when_there_is_no_share_sheet", async () => {
  const { user } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: "Share" }));

  expect(await screen.findByText("Copied")).toBeInTheDocument();
  expect(await navigator.clipboard.readText()).toBe("Milk ×2, 4 pints");
});

test("share_opens_the_share_sheet_where_there_is_one", async () => {
  const share = vi.fn(async () => {});
  vi.stubGlobal(
    "navigator",
    Object.assign(Object.create(navigator), { share }),
  );
  const { user } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: "Share" }));

  await waitFor(() =>
    expect(share).toHaveBeenCalledWith({
      title: "Corner shop",
      text: "Milk ×2, 4 pints",
    }),
  );
});

test("share_is_hidden_on_an_insecure_context_and_download_stays", async () => {
  vi.spyOn(window, "isSecureContext", "get").mockReturnValue(false);
  renderApp(`/shop/${shop.id}`, db, fakeLoop());

  expect(
    await screen.findByRole("button", { name: "Download" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Share" }),
  ).not.toBeInTheDocument();
});

test("download_saves_the_same_text_as_a_file_named_after_the_list", async () => {
  const blobs: Blob[] = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    blobs.push(blob as Blob);
    return "blob:list";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const downloads: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
  const { user } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: "Download" }));

  expect(downloads).toEqual(["Corner shop.txt"]);
  expect(await blobs[0]?.text()).toBe("Milk ×2, 4 pints");
});

test("archive_posts_after_a_confirm_and_the_pull_removes_the_shop", async () => {
  let archived = false;
  const calls = fakeFetch({
    [`POST /api/shops/${shop.id}/archive`]: () => {
      archived = true;
      return Response.json({ id: shop.id });
    },
  });
  const api = fakeSyncApi();
  api.onPull = async (since) => ({
    ...noRows(),
    revision: since + 1,
    shops: archived ? [{ ...shop, revision: 9, deletedAt: now }] : [],
  });
  const loop = createSyncLoop({
    db,
    api,
    events: () => new FakeEventSource("/sync/events"),
    now: () => now,
    online: () => true,
  });
  const { user, router } = renderApp(`/shop/${shop.id}`, db, loop);

  await user.click(await screen.findByRole("button", { name: "Archive" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Archive",
    }),
  );

  await waitFor(() => expect(router.state.location.pathname).toBe("/shop"));
  expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
    `POST /api/shops/${shop.id}/archive`,
  ]);
  expect(await live(db, "shops")).toEqual([]);
  expect(await screen.findByText(/No shopping list open/)).toBeInTheDocument();
});

test("archive_shows_the_problem_when_the_server_refuses", async () => {
  fakeFetch({
    [`POST /api/shops/${shop.id}/archive`]: () =>
      Response.json({ title: "Shop not found" }, { status: 404 }),
  });
  const { user } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: "Archive" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Archive",
    }),
  );

  expect(await screen.findByText("Shop not found")).toBeInTheDocument();
  expect(await live(db, "shops")).toHaveLength(1);
});

test("archive_is_disabled_with_a_note_while_offline", async () => {
  renderApp(
    `/shop/${shop.id}`,
    db,
    fakeLoop({ ...quietStatus, online: false }),
  );

  expect(await screen.findByRole("button", { name: "Archive" })).toBeDisabled();
  expect(
    screen.getByText("Archiving needs a connection to the server."),
  ).toBeInTheDocument();
});

test("delete_discards_the_list_after_a_confirm", async () => {
  const { user, router } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: "Delete" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Cancel",
    }),
  );
  expect(await live(db, "shops")).toHaveLength(1);

  await user.click(screen.getByRole("button", { name: "Delete" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete",
    }),
  );

  await waitFor(() => expect(router.state.location.pathname).toBe("/shop"));
  expect(await live(db, "shops")).toEqual([]);
  expect(await live(db, "shopLines")).toEqual([]);
});
