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

const banan = anItem("banan");
const banana = anItem("Banana", "bunch");
const rice = anItem("Rice");
const curry = aMeal("Curry");
const smoothie = aMeal("Smoothie");
const curryDay = aDay(0, "Curry", curry);
const shop = aShop("Corner shop");

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [banan, banana, rice],
    meals: [curry, smoothie],
    mealLines: [
      aMealLine(curry, banan, 1),
      aMealLine(curry, rice, 1),
      aMealLine(smoothie, banana, 2),
    ],
    plan: [thePlan()],
    days: [curryDay],
    dayLines: [aDayLine(curryDay, banan, 1)],
    wantedLines: [aWantedLine(banana, 1)],
    shops: [shop],
    shopLines: [aShopLine(shop, banan, 1)],
  });
});

afterEach(async () => {
  await db.delete();
});

/** Opens the curry and taps a line's name, returning the sheet. */
async function openSheet(itemName: string) {
  const app = renderApp(`/meals/${curry.id}`, db, fakeLoop());
  await app.user.click(await screen.findByRole("button", { name: itemName }));
  const sheet = await screen.findByRole("dialog", { name: itemName });
  return { ...app, sheet };
}

test("the_sheet_says_where_the_item_is_used", async () => {
  const { sheet } = await openSheet("banan");

  expect(
    await within(sheet).findByText("Used on 1 meal, 1 day, 1 list."),
  ).toBeInTheDocument();
});

test("a_blur_renames_the_item_everywhere_and_done_only_closes", async () => {
  const { user, sheet } = await openSheet("banan");

  const name = within(sheet).getByLabelText("Name");
  await user.clear(name);
  await user.type(name, "Plantain");
  await user.tab();

  await waitFor(async () =>
    expect((await db.items.get(banan.id))?.name).toBe("Plantain"),
  );
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.click(within(sheet).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("button", { name: "Plantain" })).toBeInTheDocument();
});

test("a_name_another_item_has_offers_a_merge_into_it", async () => {
  const { user, sheet } = await openSheet("banan");

  const name = within(sheet).getByLabelText("Name");
  await user.clear(name);
  await user.type(name, " banana ");
  await user.tab();
  expect(within(sheet).queryByRole("button", { name: "Done" })).toBeNull();
  expect(
    within(sheet).getByText("An item with that name exists."),
  ).toBeInTheDocument();
  expect((await db.items.get(banan.id))?.name).toBe("banan");
  await user.click(
    within(sheet).getByRole("button", { name: "Merge into Banana" }),
  );

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((await db.items.get(banan.id))?.deletedAt).not.toBeNull();
  expect(
    (await live(db, "mealLines"))
      .filter((line) => line.mealId === curry.id)
      .map((line) => line.itemId)
      .sort(),
  ).toEqual([banana.id, rice.id].sort());
  expect((await live(db, "dayLines")).map((line) => line.itemId)).toEqual([
    banana.id,
  ]);
});

test("a_blur_saves_the_usual_size", async () => {
  const { user, sheet } = await openSheet("banan");

  const size = within(sheet).getByLabelText("Usual size");
  await user.type(size, "a bunch");
  await user.tab();

  await waitFor(async () =>
    expect((await db.items.get(banan.id))?.size).toBe("a bunch"),
  );
});

test("delete_after_a_confirm_removes_the_item_and_its_lines", async () => {
  const { user, sheet } = await openSheet("banan");

  await user.click(within(sheet).getByRole("button", { name: "Delete item" }));
  await user.click(
    within(
      await screen.findByRole("dialog", { name: "Delete banan?" }),
    ).getByRole("button", { name: "Delete" }),
  );

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((await db.items.get(banan.id))?.deletedAt).not.toBeNull();
  expect(
    (await live(db, "mealLines")).map((line) => line.itemId),
  ).not.toContain(banan.id);
  expect(await live(db, "dayLines")).toEqual([]);
  expect((await live(db, "shopLines")).map((line) => line.itemId)).toEqual([
    banan.id,
  ]);
});
