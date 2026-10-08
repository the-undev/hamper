import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ArchivedShop, HistoryEntry } from "@/api/rest";
import { formatDay, formatTimestampDay } from "@/lib/dates";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeFetch } from "@/test/fake-fetch";
import { fakeLoop } from "@/test/fake-loop";
import {
  aDay,
  aMeal,
  aMealLine,
  anItem,
  live,
  seed,
  thePlan,
} from "@/test/rows";

let db: HamperDb;

const rice = anItem("Rice");
const curry = aMeal("Curry");
const archivedAt = "2026-05-30T18:00:00.000Z";

const archivedShop: ArchivedShop = {
  id: "0b0b0b0b-0000-4000-8000-000000000001",
  name: "Shop Mon 25 May",
  createdAt: "2026-05-24T10:00:00.000Z",
  archivedAt,
  planStartDate: "2026-05-25",
  planLengthDays: 7,
  meals: [
    { position: 0, name: "Curry", mealId: curry.id },
    { position: 2, name: "Takeaway", mealId: null },
  ],
  lines: [
    {
      name: "Rice",
      size: "1kg bag",
      count: 2,
      sources: ["Curry"],
      ticked: true,
    },
    { name: "Milk", size: null, count: 1, sources: ["wanted"], ticked: false },
  ],
};

const { lines: _lines, ...entryFields } = archivedShop;
const historyEntry: HistoryEntry = { ...entryFields, lineCount: 2 };

beforeEach(async () => {
  db = freshDb();
  await seed(db, {
    items: [rice],
    meals: [curry],
    mealLines: [aMealLine(curry, rice, 1)],
    plan: [thePlan("2026-06-01", 7)],
    days: [aDay(5, "Roast")],
  });
  fakeFetch({
    "GET /api/history": () => Response.json([historyEntry]),
    [`GET /api/history/${archivedShop.id}`]: () => Response.json(archivedShop),
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

test("history_lists_archived_shops_by_date_with_their_meals_and_line_count", async () => {
  renderApp("/more/history", db, fakeLoop());

  expect(
    await screen.findByRole("link", {
      name: `${formatTimestampDay(archivedAt)} Shop Mon 25 May · 2 lines · Curry, Takeaway`,
    }),
  ).toBeInTheDocument();
});

test("history_says_it_needs_a_connection_when_it_cannot_be_read", async () => {
  fakeFetch({
    "GET /api/history": () => {
      throw new TypeError("Failed to fetch");
    },
  });
  renderApp("/more/history", db, fakeLoop());

  expect(
    await screen.findByText("History needs a connection to the server."),
  ).toBeInTheDocument();
});

test("copy_these_meals_fills_the_plan_by_position_after_a_confirm", async () => {
  const { user, router } = renderApp("/more/history", db, fakeLoop());

  await user.click(
    await screen.findByRole("button", {
      name: "Copy the meals of Shop Mon 25 May to the plan",
    }),
  );
  await user.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Copy meals",
    }),
  );

  await waitFor(() => expect(router.state.location.pathname).toBe("/plan"));
  const days = (await live(db, "days")).sort(
    (first, second) => first.position - second.position,
  );
  expect(days.map((day) => [day.position, day.name, day.mealId])).toEqual([
    [0, "Curry", curry.id],
    [2, "Takeaway", null],
  ]);
});

test("an_archived_shop_opens_read_only_with_its_meals_by_day_and_its_lines", async () => {
  const { user } = renderApp("/more/history", db, fakeLoop());

  await user.click(
    await screen.findByRole("link", { name: /Shop Mon 25 May/ }),
  );

  expect(
    await screen.findByRole("heading", { name: "Shop Mon 25 May" }),
  ).toBeInTheDocument();
  expect(screen.getByText(formatDay("2026-05-27"))).toBeInTheDocument();
  expect(screen.getByText("Takeaway")).toBeInTheDocument();
  expect(screen.getByText("1kg bag · Curry")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: "Copy the meals of Shop Mon 25 May to the plan",
    }),
  ).toBeInTheDocument();
});
