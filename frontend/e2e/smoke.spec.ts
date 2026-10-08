import { expect, test } from "@playwright/test";
import { openApp } from "./helpers.ts";

test("the shell loads and the Plan shows seven days", async ({ page }) => {
  await openApp(page, "/plan");
  await expect(page).toHaveTitle("hamper");
  await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("list").first().getByRole("listitem"),
  ).toHaveCount(7);
});

test("the server answers health, the manifest and the worker", async ({
  request,
}) => {
  const health = await request.get("/health");
  expect(await health.json()).toEqual({ status: "ok" });
  expect((await request.get("/manifest.webmanifest")).ok()).toBe(true);
  expect((await request.get("/sw.js")).ok()).toBe(true);
});
