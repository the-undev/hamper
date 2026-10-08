import { expect, openApp, statusBar, test } from "./helpers.ts";

test("the worker installs, the manifest names the app, and the Plan opens offline", async ({
  page,
  context,
}) => {
  await openApp(page, "/plan");
  const workerState = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state;
  });
  expect(workerState).toBe("activated");

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
    .poll(() => statusBar(page))
    .toBe("Offline. Changes are kept on this phone.");

  await context.setOffline(false);
  await expect.poll(() => statusBar(page)).toBeNull();
});
