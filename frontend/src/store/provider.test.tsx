import { render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { freshDb } from "@/test/db";
import { fakeLoop } from "@/test/fake-loop";
import type { HamperDb } from "./db";
import { StoreProvider, useDb, useSyncLoop } from "./provider";

let db: HamperDb | null = null;

afterEach(async () => {
  await db?.delete();
});

function StoreProbe() {
  const probedDb = useDb();
  const probedLoop = useSyncLoop();
  return (
    <p>
      {probedDb.name} {probedLoop.status.get().pending}
    </p>
  );
}

test("the_provider_renders_its_children_with_the_store_and_starts_the_loop_once", () => {
  db = freshDb();
  const loop = fakeLoop();

  const { rerender, unmount } = render(
    <StoreProvider db={db} loop={loop}>
      <StoreProbe />
    </StoreProvider>,
  );
  rerender(
    <StoreProvider db={db} loop={loop}>
      <StoreProbe />
    </StoreProvider>,
  );

  expect(screen.getByText(`${db.name} 0`)).toBeInTheDocument();
  expect(loop.start).toHaveBeenCalledTimes(1);
  unmount();
  expect(loop.stop).toHaveBeenCalledTimes(1);
});
