import type { Locator, Page } from "@playwright/test";
import {
  addMeal,
  centre,
  dayCard,
  expect,
  openApp,
  placeOnDay,
  press,
  removeFromDay,
  test,
  uniqueName,
} from "./helpers.ts";

/** A PNG of the given size drawn on a canvas in the page. */
async function samplePng(
  page: Page,
  width: number,
  height: number,
): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "#c0392b";
        context.fillRect(0, 0, width, height);
        context.fillStyle = "#f1c40f";
        context.fillRect(width / 4, height / 4, width / 2, height / 2);
      }
      return canvas.toDataURL("image/png");
    },
    { width, height },
  );
  return Buffer.from(dataUrl.replace("data:image/png;base64,", ""), "base64");
}

/** Waits until a picture has loaded from the server: it is scrolled on screen, answers 200 and has pixels. */
async function expectLoaded(picture: Locator): Promise<void> {
  await expect(picture).toBeVisible();
  await picture.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      picture.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  const source = await picture.getAttribute("src");
  const response = await picture.page().request.get(source ?? "");
  expect(response.status()).toBe(200);
}

test("a meal's photo shows on its card and the plan, and Remove photo brings back the placeholder", async ({
  page,
}) => {
  const meal = uniqueName("Paella");
  await openApp(page, "/meals");
  await addMeal(page, meal, []);
  const mealUrl = page.url();

  await page.getByLabel("Photo file").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: await samplePng(page, 64, 64),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Use photo" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectLoaded(page.getByRole("main").locator("img"));

  await page.goto("/meals");
  await expectLoaded(page.getByRole("link", { name: meal }).locator("img"));

  const day = await placeOnDay(page, meal);
  const row = dayCard(page, day)
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: meal }) });
  await expectLoaded(row.locator("img"));

  await page.goto(mealUrl);
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(page.getByRole("button", { name: "Remove photo" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("main").locator("img")).toHaveCount(0);

  await page.goto("/plan");
  await removeFromDay(page, meal, day);
});

test("a finger drags the crop frame across the picture", async ({
  page,
  hasTouch,
}) => {
  test.skip(!hasTouch, "the phone project covers a finger");
  await openApp(page, "/meals");
  await addMeal(page, uniqueName("Tagine"), []);

  await page.getByLabel("Photo file").setInputFiles({
    name: "wide.png",
    mimeType: "image/png",
    buffer: await samplePng(page, 600, 300),
  });
  const dialog = page.getByRole("dialog");
  await expect
    .poll(() =>
      dialog
        .getByRole("img", { name: "Being cropped" })
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(600);
  const frame = dialog.locator(".ReactCrop__crop-selection");
  const from = await centre(frame);
  const before = await frame.boundingBox();

  const finger = await press(page, from, 0);
  await finger.moveTo({ x: from.x + 40, y: from.y });
  await finger.release();

  const after = await frame.boundingBox();
  expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0) - 40)).toBeLessThanOrEqual(
    2,
  );
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);
  expect(after?.width).toBeCloseTo(before?.width ?? 0, 0);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
});
