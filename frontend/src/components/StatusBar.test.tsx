import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeLoop, quietStatus } from "@/test/fake-loop";

let db: HamperDb;

beforeEach(() => {
  db = freshDb();
});

afterEach(async () => {
  await db.delete();
});

test("the_bar_is_hidden_online_with_nothing_to_send_and_says_offline_or_the_changes_waiting", async () => {
  const loop = fakeLoop(quietStatus);
  renderApp("/more", db, loop);
  await screen.findByRole("heading", { name: "More" });
  expect(screen.queryByText(/Offline|to send/)).not.toBeInTheDocument();

  act(() => loop.setStatus({ ...quietStatus, pending: 3 }));
  expect(screen.getByText("3 changes to send")).toBeInTheDocument();

  act(() => loop.setStatus({ ...quietStatus, pending: 1 }));
  expect(screen.getByText("1 change to send")).toBeInTheDocument();

  act(() => loop.setStatus({ ...quietStatus, online: false, pending: 2 }));
  expect(
    screen.getByText("Offline. Changes are kept on this phone."),
  ).toBeInTheDocument();
  expect(screen.queryByText(/to send/)).not.toBeInTheDocument();
});
