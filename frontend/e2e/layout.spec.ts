import type { Page } from "@playwright/test";
import { expect, openApp, planView, test } from "./helpers.ts";

// Chromium hides scrollbars under Playwright; a desktop shows them, and they take width.
test.use({
  launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] },
  viewport: { width: 1280, height: 600 },
});

test("the column stays put whether or not the view scrolls", async ({
  page,
  browserName,
}) => {
  test.skip(!!test.info().project.use.hasTouch, "a phone's scrollbar overlays");
  test.skip(
    browserName === "firefox",
    "headless Firefox's scrollbars take no width, so there is no gutter to test",
  );
  await openApp(page, "/plan");
  const main = page.getByRole("main");
  // The frame's height follows the view on show over 200 ms.
  const settled = () =>
    page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>("[data-plan-frame]");
      const shown = document.querySelector<HTMLElement>(
        "[data-plan-view]:not([inert])",
      );
      return frame?.offsetHeight === shown?.offsetHeight;
    });
  const column = async () => {
    await expect.poll(settled).toBe(true);
    const box = await main.boundingBox();
    return { x: box?.x, width: box?.width };
  };

  await planView(page, "Meals");
  const onMeals = await column();
  await planView(page, "Items");
  const onItems = await column();

  expect(onItems).toEqual(onMeals);
  await planView(page, "Meals");
});

test.describe("the column grows with the viewport up to 760px", () => {
  test.skip(({ hasTouch }) => !!hasTouch, "a phone has one width");

  const columnAt = async (
    page: Page,
    width: number,
    height: number,
  ): Promise<{
    x: number;
    width: number;
    right: number;
    contentWidth: number;
  }> => {
    await page.setViewportSize({ width, height });
    await openApp(page, "/plan");
    // A desktop scrollbar takes width and can appear late, so measure both in one go until it settles.
    const measure = () =>
      page.evaluate(() => {
        const box = document.querySelector("main")?.getBoundingClientRect();
        const contentWidth = document.body.clientWidth;
        return {
          x: box?.x ?? 0,
          width: box?.width ?? 0,
          right: contentWidth - (box?.right ?? 0),
          contentWidth,
        };
      });
    await expect
      .poll(async () => {
        const { x, right } = await measure();
        return Math.abs(x - right) <= 2;
      })
      .toBe(true)
      .catch(() => undefined);
    return measure();
  };

  test("a tablet gets a wide centred column", async ({ page }) => {
    const column = await columnAt(page, 1024, 768);

    expect(column.width).toBeGreaterThanOrEqual(700);
    expect(Math.abs(column.x - column.right)).toBeLessThanOrEqual(2);
  });

  test("a full HD desktop gets 760px, centred", async ({ page }) => {
    const column = await columnAt(page, 1920, 1080);

    expect(column.width).toBe(760);
    expect(Math.abs(column.x - column.right)).toBeLessThanOrEqual(2);
  });

  test("a phone width fills the width and keeps the gutters", async ({
    page,
  }) => {
    const column = await columnAt(page, 390, 800);
    const gutter = await page
      .getByRole("main")
      .evaluate((main) => getComputedStyle(main).paddingLeft);

    expect(column.width).toBe(
      await page.evaluate(() => document.body.clientWidth),
    );
    expect(gutter).toBe("16px");
  });
});
