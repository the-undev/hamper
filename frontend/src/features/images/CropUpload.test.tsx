import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { HamperDb } from "@/store/db";
import { renderApp } from "@/test/app";
import { freshDb } from "@/test/db";
import { fakeFetch } from "@/test/fake-fetch";
import { fakeLoop } from "@/test/fake-loop";
import { anItem, seed } from "@/test/rows";

let db: HamperDb;
const jpeg = new Blob(["cropped"], { type: "image/jpeg" });
const drawImage = vi.fn();
const bitmap = { width: 1600, height: 1000, close: vi.fn() };

beforeEach(() => {
  db = freshDb();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => bitmap),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    clearRect: vi.fn(),
    drawImage,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback: BlobCallback) => callback(jpeg),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  drawImage.mockClear();
  await db.delete();
});

test("use_photo_posts_the_cropped_jpeg_to_the_items_image_endpoint_and_syncs", async () => {
  const milk = anItem("Milk");
  await seed(db, { items: [milk] });
  const calls = fakeFetch({
    [`POST /api/items/${milk.id}/image`]: () =>
      Response.json({ imageId: "new-image" }),
  });
  const loop = fakeLoop();
  const { user } = renderApp(`/more/items/${milk.id}`, db, loop);

  await user.upload(
    await screen.findByLabelText("Photo file"),
    new File(["raw"], "photo.jpg", { type: "image/jpeg" }),
  );
  await user.click(await screen.findByRole("button", { name: "Use photo" }));

  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  const upload = calls.find((call) => call.method === "POST");
  expect(upload?.path).toBe(`/api/items/${milk.id}/image`);
  expect(upload?.body).toBe(jpeg);
  // Centred at zoom 1, a 1600 by 1000 picture covers the 1200 square by its height.
  expect(drawImage).toHaveBeenLastCalledWith(bitmap, -360, 0, 1920, 1200);
  expect(loop.syncNow).toHaveBeenCalledTimes(2);
  expect(bitmap.close).toHaveBeenCalled();
});

test("remove_photo_deletes_the_image_and_syncs", async () => {
  const milk = { ...anItem("Milk"), imageId: "old-image" };
  await seed(db, { items: [milk] });
  const calls = fakeFetch({
    [`DELETE /api/items/${milk.id}/image`]: () =>
      new Response(null, { status: 204 }),
  });
  const loop = fakeLoop();
  const { user } = renderApp(`/more/items/${milk.id}`, db, loop);

  await user.click(await screen.findByRole("button", { name: "Remove photo" }));

  await waitFor(() => expect(loop.syncNow).toHaveBeenCalled());
  expect(calls.map((call) => `${call.method} ${call.path}`)).toContain(
    `DELETE /api/items/${milk.id}/image`,
  );
});

test("a_refused_upload_shows_the_servers_reason", async () => {
  const milk = anItem("Milk");
  await seed(db, { items: [milk] });
  fakeFetch({
    [`POST /api/items/${milk.id}/image`]: () =>
      Response.json(
        { title: "Not an image", status: 400 },
        {
          status: 400,
          headers: { "Content-Type": "application/problem+json" },
        },
      ),
  });
  const { user } = renderApp(`/more/items/${milk.id}`, db, fakeLoop());

  await user.upload(
    await screen.findByLabelText("Photo file"),
    new File(["raw"], "photo.jpg", { type: "image/jpeg" }),
  );
  await user.click(await screen.findByRole("button", { name: "Use photo" }));

  expect(await screen.findByText("Not an image")).toBeInTheDocument();
});
