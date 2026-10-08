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
