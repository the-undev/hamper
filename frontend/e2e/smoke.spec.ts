import { expect, openApp, test } from "./helpers.ts";

test("the shell loads and the Plan shows seven days", async ({ page }) => {
  await openApp(page, "/plan");
  await expect(page).toHaveTitle("hamper");
  await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
  // Every day's card ends with its own "Add a meal".
  await expect(page.getByRole("link", { name: /^Add a meal to / })).toHaveCount(
    7,
  );
});

test("the server answers health, the manifest and the worker", async ({
  request,
}) => {
  const health = await request.get("/health");
  expect(await health.json()).toEqual({ status: "ok" });
  expect((await request.get("/manifest.webmanifest")).ok()).toBe(true);
  expect((await request.get("/sw.js")).ok()).toBe(true);
});
