import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { writeSetting } from "@/lib/settings";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import { anItem, aWantedLine, live, seed, thePlan } from "@/test/rows";

let db: HamperDb;

const milk = anItem("Milk", "4 pints");

beforeEach(async () => {
  db = freshDb();
  await seed(db, { items: [milk], plan: [thePlan("2026-06-01", 7)] });
  writeSetting("planView", "items");
});

afterEach(async () => {
  await db.delete();
});

test("the_items_view_opens_when_it_was_the_last_one_used", async () => {
  renderApp("/plan", db, fakeLoop());

  expect(await screen.findByRole("tab", { name: "Items" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    await screen.findByText("Nothing wanted beyond the meals"),
  ).toBeInTheDocument();
});

test("adding_from_the_items_view_puts_a_known_or_new_item_on_the_wanted_list", async () => {
  const { user } = renderApp("/plan", db, fakeLoop());
  const typeAhead = await screen.findByLabelText("Add an item");

  await user.type(typeAhead, "milk{Enter}");
  await user.type(typeAhead, "Loo roll{Enter}");
  await user.type(typeAhead, "milk{Enter}");

  expect(await screen.findByText("Loo roll")).toBeInTheDocument();
  expect(screen.getByText("4 pints")).toBeInTheDocument();
  const looRoll = (await live(db, "items")).find(
    (item) => item.name === "Loo roll",
  );
  await waitFor(async () =>
    expect(
      new Map(
        (await live(db, "wantedLines")).map((line) => [
          line.itemId,
          [line.count, line.weekly],
        ]),
      ),
    ).toEqual(
      new Map([
        [milk.id, [2, false]],
        [looRoll?.id, [1, false]],
      ]),
    ),
  );
});

test("the_once_weekly_toggle_marks_the_line", async () => {
  const milkLine = aWantedLine(milk, 1, false);
  await seed(db, { wantedLines: [milkLine] });
  const { user } = renderApp("/plan", db, fakeLoop());

  await user.click(await screen.findByRole("button", { name: "Milk: Once" }));

  expect(
    await screen.findByRole("button", { name: "Milk: Weekly" }),
  ).toBeInTheDocument();
  expect((await db.wantedLines.get(milkLine.id))?.weekly).toBe(true);

  await user.click(screen.getByRole("button", { name: "Milk: Weekly" }));

  await waitFor(async () =>
    expect((await db.wantedLines.get(milkLine.id))?.weekly).toBe(false),
  );
});

test("a_wanted_line_counts_up_and_down_and_swipes_away", async () => {
  const milkLine = aWantedLine(milk, 2, true);
  await seed(db, { wantedLines: [milkLine] });
  const { user } = renderApp("/plan", db, fakeLoop());

  await user.click(
    await screen.findByRole("button", { name: "One more Milk" }),
  );
  await waitFor(async () =>
    expect((await db.wantedLines.get(milkLine.id))?.count).toBe(3),
  );
  await user.click(screen.getByRole("button", { name: "Remove Milk" }));

  expect(
    await screen.findByText("Nothing wanted beyond the meals"),
  ).toBeInTheDocument();
  expect(await live(db, "wantedLines")).toEqual([]);
});
