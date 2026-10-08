import { expect, openApp, syncState, test } from "./helpers.ts";

test("the worker installs, the manifest names the app, and the Plan opens offline", async ({
  page,
  context,
  browserName,
}) => {
  await openApp(page, "/plan");
  // ready resolves once a worker is active, which can still be activating.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        return registration.active?.state;
      }),
    )
    .toBe("activated");

  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  const manifest = await (await page.request.get(manifestHref ?? "")).json();
  expect(manifest).toMatchObject({ name: "hamper", display: "standalone" });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/^Starts /)).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("list").first().getByRole("listitem"),
  ).toHaveCount(7);
  await expect
    .poll(() => syncState(page))
    .toBe("Offline. Changes are kept on this phone.");

  await context.setOffline(false);
  if (browserName === "firefox") {
    // Playwright's Firefox fires no online event for a page loaded while offline, so the test sends it.
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
  }
  await expect.poll(() => syncState(page)).toBeNull();
});
