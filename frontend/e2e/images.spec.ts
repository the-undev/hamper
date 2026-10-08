import type { Locator, Page } from "@playwright/test";
import {
  addMeal,
  clearDay,
  dayHandle,
  expect,
  openApp,
  placeOnFirstEmptyDay,
  test,
  uniqueName,
} from "./helpers.ts";

/** A 64 by 64 PNG drawn on a canvas in the page. */
async function samplePng(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#c0392b";
      context.fillRect(0, 0, 64, 64);
      context.fillStyle = "#f1c40f";
      context.fillRect(16, 16, 32, 32);
    }
    return canvas.toDataURL("image/png");
  });
  return Buffer.from(dataUrl.replace("data:image/png;base64,", ""), "base64");
}

/** Waits until a picture has loaded from the server: the image answers 200 and has pixels. */
async function expectLoaded(picture: Locator): Promise<void> {
  await expect(picture).toBeVisible();
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
    buffer: await samplePng(page),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Use photo" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectLoaded(page.getByRole("main").locator("img"));

  await page.goto("/meals");
  await expectLoaded(page.getByRole("link", { name: meal }).locator("img"));

  const day = await placeOnFirstEmptyDay(page, meal);
  const slot = page
    .getByRole("listitem")
    .filter({ has: dayHandle(page, meal, day) });
  await expectLoaded(slot.locator("img"));

  await page.goto(mealUrl);
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(page.getByRole("button", { name: "Remove photo" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("main").locator("img")).toHaveCount(0);

  await page.goto("/plan");
  await clearDay(page, day);
});
