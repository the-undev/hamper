import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import { aMeal, live, seed, thePlan } from "@/test/rows";

let db: HamperDb;
const curry = aMeal("Curry");

beforeEach(async () => {
  db = freshDb();
  await seed(db, { meals: [curry], plan: [thePlan()] });
});

afterEach(async () => {
  await db.delete();
});

test("an_add_shows_a_toast_whose_undo_takes_the_add_back", async () => {
  const { user } = renderApp(`/meals/${curry.id}`, db, fakeLoop());

  await user.type(
    await screen.findByLabelText("Add an item to this meal"),
    "Coriander{Enter}",
  );

  expect(await screen.findByText("Added Coriander")).toBeInTheDocument();
  expect(await live(db, "mealLines")).toHaveLength(1);

  await user.click(screen.getByRole("button", { name: "Undo" }));

  await waitFor(async () => expect(await live(db, "mealLines")).toEqual([]));
  expect(await live(db, "items")).toEqual([]);
  expect(screen.queryByText("Added Coriander")).not.toBeInTheDocument();
});
