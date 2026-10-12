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
  await planView(page, "Extras");
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
        const contentWidth =
          document.querySelector("[data-scroll-area]")?.clientWidth ?? 0;
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

  for (const colorScheme of ["light", "dark"] as const) {
    test(`the surface colour fills the display around the column in ${colorScheme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await columnAt(page, 1920, 1080);
      const background = (selector: string) =>
        page.evaluate(
          (selector) =>
            getComputedStyle(document.querySelector(selector) as Element)
              .backgroundColor,
          selector,
        );
      const shell = await page.evaluate(
        () =>
          getComputedStyle(
            document.querySelector("main")?.closest(".bg-surface") as Element,
          ).backgroundColor,
      );

      expect(await background("body")).toBe(shell);
    });
  }

  test("a phone width fills the width and keeps the gutters", async ({
    page,
  }) => {
    const column = await columnAt(page, 390, 800);
    const gutter = await page
      .getByRole("main")
      .evaluate((main) => getComputedStyle(main).paddingLeft);

    expect(column.width).toBe(
      await page.evaluate(
        () => document.querySelector("[data-scroll-area]")?.clientWidth,
      ),
    );
    expect(gutter).toBe("16px");
  });
});

test.describe("a placeholder is fainter than typed text", () => {
  test.skip(({ hasTouch }) => !!hasTouch, "the desktop projects cover it");

  for (const colorScheme of ["light", "dark"] as const) {
    test(`the add box placeholder sits closer to the surface than its text in ${colorScheme} mode`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await openApp(page, "/plan");
      await planView(page, "Extras");
      const colours = await page
        .getByRole("combobox", { name: "Add to extras" })
        .evaluate((input) => {
          const pixel = document.createElement("canvas").getContext("2d", {
            willReadFrequently: true,
          }) as CanvasRenderingContext2D;
          const luminance = (colour: string) => {
            pixel.clearRect(0, 0, 1, 1);
            pixel.fillStyle = colour;
            pixel.fillRect(0, 0, 1, 1);
            const [r = 0, g = 0, b = 0] = pixel.getImageData(0, 0, 1, 1).data;
            return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          };
          const typed = getComputedStyle(input).color;
          const placeholder = getComputedStyle(input, "::placeholder").color;
          const surface = getComputedStyle(input).backgroundColor;
          return {
            typed,
            placeholder,
            typedGap: Math.abs(luminance(typed) - luminance(surface)),
            placeholderGap: Math.abs(
              luminance(placeholder) - luminance(surface),
            ),
          };
        });

      expect(colours.placeholder).not.toBe(colours.typed);
      expect(colours.placeholderGap).toBeLessThan(colours.typedGap);
    });
  }
});

test("the Plan tabs do not move while the days scroll", async ({ page }) => {
  await openApp(page, "/plan");
  await planView(page, "Meals");
  const scrollArea = page.locator("[data-scroll-area]");
  const firstDay = page.getByRole("listitem").first();
  await expect(firstDay).toBeVisible();
  const tabList = page.getByRole("tablist", { name: "Plan view" });
  await expect(tabList).toBeVisible();
  const restingTabListBox = await tabList.boundingBox();
  const restingFirstDayBox = await firstDay.boundingBox();
  expect(restingFirstDayBox?.y ?? 0).toBeGreaterThanOrEqual(
    (restingTabListBox?.y ?? 0) + (restingTabListBox?.height ?? 0) + 14,
  );

  await scrollArea.evaluate((area) => area.scrollTo(0, 300));
  await expect
    .poll(() => scrollArea.evaluate((area) => area.scrollTop))
    .toBeGreaterThan(100);

  const tabListBox = await tabList.boundingBox();
  const firstDayBox = await firstDay.boundingBox();
  expect(tabListBox?.y ?? 0).toBeCloseTo(restingTabListBox?.y ?? 0, 0);
  expect(firstDayBox?.y ?? 0).toBeLessThan(
    (tabListBox?.y ?? 0) + (tabListBox?.height ?? 0),
  );

  const probe = {
    x: (tabListBox?.x ?? 0) + (tabListBox?.width ?? 0) / 2,
    y: (tabListBox?.y ?? 0) + (tabListBox?.height ?? 0) + 6,
  };
  const probeInsideDayCard = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest("[data-position]") !== null,
    probe,
  );
  expect(probeInsideDayCard).toBe(false);
});
