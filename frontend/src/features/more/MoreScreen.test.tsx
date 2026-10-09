import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { formatTime, formatTimestampDay } from "@/lib/dates";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeFetch } from "@/test/fake-fetch";
import { fakeLoop, quietStatus } from "@/test/fake-loop";
import { anItem, seed } from "@/test/rows";

let db: HamperDb;

beforeEach(async () => {
  db = freshDb();
  await seed(db, { items: [anItem("Rice"), anItem("Milk")] });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await db.delete();
});

function chooseZip(): File {
  const zip = new File(["zip bytes"], "hamper-20260601-090000.zip", {
    type: "application/zip",
  });
  fireEvent.change(screen.getByLabelText(/^Import/), {
    target: { files: [zip] },
  });
  return zip;
}

test("the_menu_links_items_and_history_and_exports_through_a_download_link", async () => {
  renderApp("/more", db, fakeLoop());

  expect(
    await screen.findByRole("link", { name: /^Items\s*2 known$/ }),
  ).toHaveAttribute("href", "/more/items");
  expect(screen.getByRole("link", { name: /^History/ })).toHaveAttribute(
    "href",
    "/more/history",
  );
  const exportLink = screen.getByRole("link", { name: /^Export everything/ });
  expect(exportLink).toHaveAttribute("href", "/api/export");
  expect(exportLink).toHaveAttribute("download");
});

test("import_posts_the_file_says_imported_and_syncs", async () => {
  const calls = fakeFetch({
    "POST /api/import": () => new Response(null, { status: 200 }),
  });
  const loop = fakeLoop();
  renderApp("/more", db, loop);
  await screen.findByRole("link", { name: /^Items/ });

  const zip = chooseZip();

  expect(await screen.findByText("Imported")).toBeInTheDocument();
  expect(calls).toEqual([{ method: "POST", path: "/api/import", body: zip }]);
  expect(loop.syncNow).toHaveBeenCalledTimes(1);
});

test("import_shows_the_problem_title_when_the_instance_is_not_empty", async () => {
  fakeFetch({
    "POST /api/import": () =>
      Response.json(
        { title: "This instance already has data" },
        { status: 409 },
      ),
  });
  const loop = fakeLoop();
  renderApp("/more", db, loop);
  await screen.findByRole("link", { name: /^Items/ });

  chooseZip();

  expect(
    await screen.findByText("This instance already has data"),
  ).toBeInTheDocument();
  expect(loop.syncNow).not.toHaveBeenCalled();
});

test("the_sync_status_says_when_the_last_sync_finished", async () => {
  const lastSyncAt = "2026-06-01T09:30:00.000Z";
  renderApp(
    "/more",
    db,
    fakeLoop({ ...quietStatus, lastSyncAt, lastError: "Bad change" }),
  );

  expect(
    await screen.findByText(
      `Last synced ${formatTimestampDay(lastSyncAt)} at ${formatTime(lastSyncAt)}. The server refused the last changes: Bad change.`,
    ),
  ).toBeInTheDocument();
});

test("the_https_line_shows_only_on_an_insecure_context", async () => {
  const httpsLine = "Offline, install and share need the HTTPS address.";
  renderApp("/more", db, fakeLoop());
  await screen.findByRole("heading", { name: "More" });
  expect(screen.queryByText(httpsLine)).not.toBeInTheDocument();
  cleanup();

  vi.spyOn(window, "isSecureContext", "get").mockReturnValue(false);
  renderApp("/more", db, fakeLoop());

  expect(await screen.findByText(httpsLine)).toBeInTheDocument();
});
