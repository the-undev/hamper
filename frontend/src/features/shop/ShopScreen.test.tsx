import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import {
  anItem,
  aShop,
  aShopLine,
  aWantedLine,
  live,
  seed,
  thePlan,
} from "@/test/rows";

let db: HamperDb;

const milk = anItem("Milk", "4 pints");
const rice = anItem("Rice", "1kg bag");
const bread = anItem("Bread");
const shop = aShop("Corner shop");
const milkLine = {
  ...aShopLine(shop, milk, 1),
  createdAt: "2026-06-01T09:00:00.000Z",
};
const riceLine = {
  ...aShopLine(shop, rice, 2),
  createdAt: "2026-06-01T09:01:00.000Z",
};
const breadLine = {
  ...aShopLine(shop, bread, 1),
  createdAt: "2026-06-01T09:02:00.000Z",
};

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [milk, rice, bread],
    plan: [thePlan("2026-06-01", 7)],
    shops: [shop],
    shopLines: [milkLine, riceLine, breadLine],
  });
});

afterEach(async () => {
  await db.delete();
});

function namesIn(regionName: string): string[] {
  return within(screen.getByRole("region", { name: regionName }))
    .getAllByRole("checkbox")
    .map((box) => box.getAttribute("aria-label") ?? "");
}

test("ticking_a_line_sinks_it_into_the_trolley", async () => {
  const { user } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.click(
    await screen.findByRole("checkbox", { name: "Milk in the trolley" }),
  );
  expect(
    await screen.findByRole("region", { name: "In the trolley" }),
  ).toBeInTheDocument();
  expect(namesIn("To get")).toEqual([
    "Rice in the trolley",
    "Bread in the trolley",
  ]);
  expect(namesIn("In the trolley")).toEqual(["Milk in the trolley"]);
  expect(
    screen.getByText("Corner shop. 1 of 3 in the trolley."),
  ).toBeInTheDocument();
  expect((await db.shopLines.get(milkLine.id))?.ticked).toBe(true);
});

test("the_line_editor_edits_the_lines_own_text_and_count_and_leaves_the_item", async () => {
  const { user } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: /^Milk/ }));
  const editor = await screen.findByRole("dialog");
  const nameInput = within(editor).getByLabelText("Name");
  await user.clear(nameInput);
  await user.type(nameInput, "Oat milk");
  await user.click(
    within(editor).getByRole("button", { name: "One more Milk" }),
  );
  await user.click(within(editor).getByRole("button", { name: "Done" }));

  expect(
    await screen.findByRole("checkbox", { name: "Oat milk in the trolley" }),
  ).toBeInTheDocument();
  expect(await db.shopLines.get(milkLine.id)).toMatchObject({
    nameOverride: "Oat milk",
    sizeOverride: null,
    count: 2,
  });
  expect(await db.items.get(milk.id)).toEqual(milk);
});

test("the_count_is_changed_on_the_row", async () => {
  const { user } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.click(
    await screen.findByRole("button", { name: "One more Rice" }),
  );
  await user.click(screen.getByRole("button", { name: "One fewer Rice" }));
  await user.click(screen.getByRole("button", { name: "One fewer Rice" }));

  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "One fewer Rice" }),
    ).toBeDisabled(),
  );
  expect((await db.shopLines.get(riceLine.id))?.count).toBe(1);
  expect(await db.items.get(rice.id)).toEqual(rice);
});

test("out_of_stock_in_the_editor_and_to_wanted_on_the_swipe_move_lines_to_wanted", async () => {
  await seed(db, { wantedLines: [aWantedLine(rice, 1, true)] });
  const { user } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.click(
    await screen.findByRole("button", { name: "To wanted Rice" }),
  );
  await user.click(screen.getByRole("button", { name: /^Milk/ }));
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "To wanted",
    }),
  );

  await waitFor(async () =>
    expect((await live(db, "shopLines")).map((line) => line.itemId)).toEqual([
      bread.id,
    ]),
  );
  expect(
    new Map(
      (await live(db, "wantedLines")).map((line) => [
        line.itemId,
        [line.count, line.weekly],
      ]),
    ),
  ).toEqual(
    new Map([
      [rice.id, [3, true]],
      [milk.id, [1, false]],
    ]),
  );
});

test("rest_to_wanted_moves_every_unticked_line", async () => {
  await seed(db, { shopLines: [{ ...milkLine, ticked: true }] });
  const { user } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.click(
    await screen.findByRole("button", { name: "Rest to wanted" }),
  );

  expect(
    await screen.findByText("Everything is in the trolley"),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Rest to wanted" })).toBeDisabled();
  expect(
    (await live(db, "wantedLines")).map((line) => line.itemId).sort(),
  ).toEqual([rice.id, bread.id].sort());
});

test("a_line_is_added_by_typing", async () => {
  const { user } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.type(
    await screen.findByLabelText("Add to this list"),
    "Eggs{Enter}",
  );

  expect(
    await screen.findByRole("checkbox", { name: "Eggs in the trolley" }),
  ).toBeInTheDocument();
});

test("start_empty_makes_a_second_list_switchable_in_the_row", async () => {
  const { user, router } = renderApp(`/shop/${shop.id}`, db, fakeLoop());

  await user.click(
    await screen.findByRole("button", { name: "Start another list" }),
  );
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Start empty",
    }),
  );

  expect(
    await screen.findByText("Nothing on this list yet"),
  ).toBeInTheDocument();
  const lists = screen.getByRole("navigation", { name: "Lists" });
  await waitFor(() =>
    expect(within(lists).getAllByRole("link")).toHaveLength(2),
  );
  const links = within(lists).getAllByRole("link");
  expect(links[1]).toHaveAttribute("aria-current", "page");
  expect(links[1]).toHaveTextContent(/^Quick shop .*0 to get$/);

  await user.click(within(lists).getByRole("link", { name: /^Corner shop/ }));

  expect(
    await screen.findByRole("checkbox", { name: "Milk in the trolley" }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe(`/shop/${shop.id}`);
});

test("the_shop_tab_opens_the_list_used_last", async () => {
  const otherShop = {
    ...aShop("Market"),
    createdAt: "2026-06-02T09:00:00.000Z",
  };
  await seed(db, { shops: [otherShop] });
  const { user, router } = renderApp(`/shop/${shop.id}`, db, fakeLoop());
  await screen.findByRole("checkbox", { name: "Milk in the trolley" });

  await user.click(screen.getByRole("link", { name: "More" }));
  await screen.findByRole("heading", { name: "More" });
  await user.click(screen.getByRole("link", { name: "Shop" }));

  await waitFor(() =>
    expect(router.state.location.pathname).toBe(`/shop/${shop.id}`),
  );
});
