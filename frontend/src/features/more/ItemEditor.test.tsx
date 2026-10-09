import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import {
  aDay,
  aDayLine,
  aMeal,
  aMealLine,
  anItem,
  aShop,
  aShopLine,
  aWantedLine,
  live,
  seed,
  thePlan,
} from "@/test/rows";

let db: HamperDb;

const potatoes = anItem("Potatoes", "1kg bag");
const spuds = anItem("Spuds");
const rice = anItem("Rice");
const roast = aMeal("Roast");
const roastDay = aDay(0, "Roast", roast);
const shop = aShop("Corner shop");

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [potatoes, spuds, rice],
    meals: [roast],
    mealLines: [aMealLine(roast, spuds, 1)],
    plan: [thePlan("2026-06-01", 7)],
    days: [roastDay],
    dayLines: [aDayLine(roastDay, potatoes, 2), aDayLine(roastDay, spuds, 1)],
    wantedLines: [aWantedLine(spuds, 1)],
    shops: [shop],
    shopLines: [aShopLine(shop, spuds, 4)],
  });
});

afterEach(async () => {
  await db.delete();
});

test("the_items_list_shows_every_live_item_with_its_size_and_a_search", async () => {
  const { user } = renderApp("/more/items", db, fakeLoop());

  expect(
    await screen.findByRole("link", { name: /^Potatoes\s*1kg bag$/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /^Rice\s*no usual size$/ }),
  ).toBeInTheDocument();

  await user.type(screen.getByLabelText("Find an item"), "spu");

  expect(screen.getAllByRole("link", { name: /usual size|bag/ })).toHaveLength(
    1,
  );
  expect(screen.getByRole("link", { name: /^Spuds/ })).toBeInTheDocument();
});

test("a_rename_shows_everywhere_the_item_is_used", async () => {
  const { user, router } = renderApp(
    `/more/items/${potatoes.id}`,
    db,
    fakeLoop(),
  );

  const name = await screen.findByLabelText("Name");
  await user.clear(name);
  await user.type(name, "Maris Pipers");
  const size = screen.getByLabelText("Usual size");
  await user.clear(size);
  await user.type(size, "2kg bag");
  const footer = screen.getByRole("group", { name: "Screen actions" });
  await user.click(within(footer).getByRole("button", { name: "Done" }));
  await waitFor(async () =>
    expect(await db.items.get(potatoes.id)).toMatchObject({
      name: "Maris Pipers",
      size: "2kg bag",
    }),
  );

  await router.navigate({
    to: "/plan/day/$position",
    params: { position: "0" },
  });

  expect(await screen.findByText("Maris Pipers")).toBeInTheDocument();
  expect(screen.getByText("2kg bag")).toBeInTheDocument();
});

test("merge_repoints_and_combines_after_a_confirm", async () => {
  const { user, router } = renderApp(`/more/items/${spuds.id}`, db, fakeLoop());

  await user.type(await screen.findByLabelText("Merge into"), "pot");
  await user.click(screen.getByRole("option", { name: /^Potatoes/ }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Merge",
    }),
  );

  await waitFor(() =>
    expect(router.state.location.pathname).toBe(`/more/items/${potatoes.id}`),
  );
  expect((await db.items.get(spuds.id))?.deletedAt).not.toBeNull();
  expect(
    (await live(db, "dayLines")).map((line) => [line.itemId, line.count]),
  ).toEqual([[potatoes.id, 3]]);
  expect((await live(db, "mealLines")).map((line) => line.itemId)).toEqual([
    potatoes.id,
  ]);
  expect((await live(db, "wantedLines")).map((line) => line.itemId)).toEqual([
    potatoes.id,
  ]);
  expect(
    (await live(db, "shopLines")).map((line) => [line.itemId, line.count]),
  ).toEqual([[potatoes.id, 4]]);
});

test("delete_removes_the_item_and_its_lines_after_a_confirm_and_open_lists_keep_theirs", async () => {
  const { user, router } = renderApp(`/more/items/${spuds.id}`, db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: "Delete item" }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Delete",
    }),
  );

  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/more/items"),
  );
  expect((await live(db, "items")).map((item) => item.name).sort()).toEqual([
    "Potatoes",
    "Rice",
  ]);
  expect((await live(db, "dayLines")).map((line) => line.itemId)).toEqual([
    potatoes.id,
  ]);
  expect(await live(db, "mealLines")).toEqual([]);
  expect(await live(db, "wantedLines")).toEqual([]);
  expect(await live(db, "shopLines")).toHaveLength(1);
});

test("done_in_the_footer_goes_back_to_the_items_list", async () => {
  const { user, router } = renderApp("/more/items", db, fakeLoop());
  await user.click(await screen.findByRole("link", { name: /^Potatoes/ }));
  // The footer above the tab bar is a fieldset, so a group named Screen actions rather than a contentinfo landmark.
  const footer = await screen.findByRole("group", { name: "Screen actions" });

  await user.click(within(footer).getByRole("button", { name: "Done" }));

  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/more/items"),
  );
  expect(router.history.canGoBack()).toBe(false);
});
