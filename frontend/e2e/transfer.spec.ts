import { expect, openApp, test } from "./helpers.ts";

test("export downloads a zip, which this instance refuses to import because it is not empty", async ({
  page,
}) => {
  await openApp(page, "/more");
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: /^Export everything/ }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^hamper-\d{8}-\d{6}\.zip$/);

  await page
    .getByRole("button", { name: "Import into an empty instance" })
    .setInputFiles(await download.path());
  await expect(page.getByText("Database is not empty")).toBeVisible();
});
