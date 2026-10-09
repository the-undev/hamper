import { readFile } from "node:fs/promises";
import type { Locator, Page } from "@playwright/test";
import {
  addLine,
  addMeal,
  clearDay,
  expect,
  expectCount,
  line,
  openApp,
  placeOnFirstEmptyDay,
  planView,
  swipeLeft,
  tab,
  test,
  uniqueName,
} from "./helpers.ts";

/** A line of the open list by the name it shows, found by its tick box, on the page or within a section of it. */
function shopLine(scope: Page | Locator, name: string): Locator {
  const page = "page" in scope ? scope.page() : scope;
  return scope.getByRole("listitem").filter({
    has: page.getByRole("checkbox", { name: `${name} in the trolley` }),
  });
}

/** Opens Shop with no list open and starts an empty one. */
async function startEmptyList(page: Page): Promise<void> {
  await openApp(page, "/shop");
  await page.getByRole("button", { name: "Start empty" }).click();
  await expect(
    page.getByRole("combobox", { name: "Add to this list" }),
  ).toBeVisible();
}

/** The cards of the open lists on the Shop tab. */
function listCards(page: Page): Locator {
  return page.getByRole("list", { name: "Open lists" }).getByRole("link");
}

/** Deletes the open list after its confirm, and waits until the page has left it. */
async function deleteList(page: Page): Promise<void> {
  const listUrl = page.url();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).not.toHaveURL(listUrl);
}

/** Takes an item's line off the extras list on the Plan's Extras view. */
async function removeExtra(page: Page, itemName: string): Promise<void> {
  await page.goto("/plan");
  await planView(page, "Extras");
  await swipeLeft(
    page,
    line(page, itemName).getByText(itemName, { exact: true }),
  );
  await page.getByRole("button", { name: `Remove ${itemName}` }).click();
  await expect(line(page, itemName)).toHaveCount(0);
}

test("Make from plan edits the plan and generates a list with summed counts", async ({
  page,
}) => {
  const meal = uniqueName("Tacos");
  const shared = uniqueName("Cheese");
  const extra = uniqueName("Limes");
  await openApp(page, "/meals");
  await addMeal(page, meal, [shared]);
  const day = await placeOnFirstEmptyDay(page, meal);
  await planView(page, "Extras");
  const addExtra = page.getByRole("combobox", { name: "Add to extras" });
  await addExtra.fill(shared);
  await addExtra.press("Enter");
  await expect(line(page, shared)).toBeVisible();
  await addLine(page, "Add to extras", extra);

  await tab(page, "Shop");
  await page.getByRole("button", { name: "Make from plan" }).click();
  const daySection = page.getByRole("region", { name: new RegExp(meal) });
  const extrasSection = page.getByRole("region", { name: "Extras" });
  await expect(line(daySection, shared)).toBeVisible();
  await expect(line(extrasSection, shared)).toBeVisible();
  await expect(line(extrasSection, extra)).toBeVisible();
  await line(daySection, shared)
    .getByRole("button", { name: `One more ${shared}` })
    .click();
  await expectCount(line(daySection, shared), 2);

  await page.getByRole("button", { name: "Generate the list" }).click();
  await expectCount(shopLine(page, shared), 3);
  await expect(shopLine(page, shared)).toContainText(`${meal}, extras`);
  await expectCount(shopLine(page, extra), 1);
  await expect(shopLine(page, extra)).toContainText("extras");
  await deleteList(page);

  await page.goto("/plan");
  await planView(page, "Meals");
  await page.getByRole("link", { name: meal }).click();
  await expectCount(line(page, shared), 2);
  await page.getByRole("button", { name: "Done" }).click();
  await clearDay(page, day);
  await removeExtra(page, shared);
  await removeExtra(page, extra);
});

test("a list's lines tick, count, edit, go to extras, and a second list sits beside it", async ({
  page,
}) => {
  const ticked = uniqueName("Apples");
  const counted = uniqueName("Eggs");
  const swiped = uniqueName("Flour");
  const rest = uniqueName("Sugar");
  await startEmptyList(page);
  for (const name of [ticked, counted, swiped, rest]) {
    await page.getByRole("combobox", { name: "Add to this list" }).fill(name);
    await page.getByRole("option", { name: `Add “${name}”` }).click();
    await expect(shopLine(page, name)).toBeVisible();
  }

  await page
    .getByRole("checkbox", { name: `${ticked} in the trolley` })
    .click();
  await expect(
    page.getByRole("checkbox", { name: `${ticked} in the trolley` }),
  ).toBeChecked();
  const trolley = page.getByRole("region", { name: "In the trolley" });
  await expect(shopLine(trolley, ticked)).toBeVisible();
  await expect(
    shopLine(page.getByRole("region", { name: "To get" }), ticked),
  ).toHaveCount(0);

  await page.getByRole("button", { name: `One more ${counted}` }).click();
  await expectCount(shopLine(page, counted), 2);
  await page.getByRole("button", { name: `One fewer ${counted}` }).click();
  await expectCount(shopLine(page, counted), 1);

  const renamed = `${counted} large`;
  await page.getByRole("button", { name: new RegExp(`^${counted}`) }).click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("textbox", { name: "Name" }).fill(renamed);
  await editor.getByRole("button", { name: "Done" }).click();
  await expect(shopLine(page, renamed)).toBeVisible();

  await swipeLeft(
    page,
    page.getByRole("button", { name: new RegExp(`^${swiped}`) }),
  );
  await page.getByRole("button", { name: `To extras ${swiped}` }).click();
  await expect(shopLine(page, swiped)).toHaveCount(0);

  await page.getByRole("button", { name: "Rest to extras" }).click();
  await expect(shopLine(page, rest)).toHaveCount(0);
  await expect(shopLine(page, renamed)).toHaveCount(0);
  await expect(shopLine(page, ticked)).toBeVisible();

  await page.getByRole("link", { name: "‹ Lists" }).click();
  await expect(listCards(page)).toHaveCount(1);
  await expect(listCards(page)).toContainText("1 of 1 got");
  await page.getByRole("button", { name: "Start empty" }).click();
  await expect(page.getByText("Nothing on this list yet")).toBeVisible();
  await page.getByRole("link", { name: "‹ Lists" }).click();
  await expect(listCards(page)).toHaveCount(2);
  await listCards(page).first().click();
  await deleteList(page);
  await expect(listCards(page)).toHaveCount(1);
  await listCards(page).first().click();
  await deleteList(page);
  await expect(listCards(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Make from plan" }),
  ).toBeVisible();

  await page.goto("/more/items");
  await page.getByRole("searchbox", { name: "Find an item" }).fill(counted);
  await expect(
    page.getByRole("link", { name: new RegExp(`^${counted}`) }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: new RegExp(`^${renamed}`) }),
  ).toHaveCount(0);

  await page.goto("/plan");
  await planView(page, "Extras");
  for (const name of [swiped, rest, counted]) {
    await expect(line(page, name)).toBeVisible();
  }
  for (const name of [swiped, rest, counted]) {
    await removeExtra(page, name);
  }
});

test("an archived list goes to History, which can copy its meals back", async ({
  page,
}) => {
  const meal = uniqueName("Risotto");
  const item = uniqueName("Arborio");
  await openApp(page, "/meals");
  await addMeal(page, meal, [item]);
  const day = await placeOnFirstEmptyDay(page, meal);

  await tab(page, "Shop");
  await page.getByRole("button", { name: "Make from plan" }).click();
  await page.getByRole("button", { name: "Generate the list" }).click();
  await expect(shopLine(page, item)).toBeVisible();
  await page.getByRole("button", { name: "Archive" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Archive" })
    .click();
  await expect(
    page.getByRole("button", { name: "Make from plan" }),
  ).toBeVisible();

  await page.goto("/plan");
  await clearDay(page, day);

  await page.goto("/more/history");
  const entry = page.getByRole("listitem").filter({ hasText: meal });
  await expect(entry.getByRole("link")).toContainText("1 lines");
  await entry.getByRole("link").click();
  await expect(
    page.getByRole("heading", { name: "Archived shop" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText(item);
  await page.getByRole("button", { name: /^Copy the meals of / }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Copy meals" })
    .click();

  await expect(page.getByRole("link", { name: meal })).toBeVisible();
  await clearDay(page, day);
});

test("a deleted list is gone", async ({ page }) => {
  await startEmptyList(page);
  await deleteList(page);
  await expect(
    page.getByRole("button", { name: "Make from plan" }),
  ).toBeVisible();
  await expect(listCards(page)).toHaveCount(0);
});

test("ticking the last line offers Archive and the list leaves", async ({
  page,
}) => {
  const first = uniqueName("Bread");
  const last = uniqueName("Butter");
  await startEmptyList(page);
  for (const name of [first, last]) {
    await page.getByRole("combobox", { name: "Add to this list" }).fill(name);
    await page.getByRole("option", { name: `Add “${name}”` }).click();
    await expect(shopLine(page, name)).toBeVisible();
  }
  const offer = page.getByText("Everything got. Archive the list?");

  await page.getByRole("checkbox", { name: `${first} in the trolley` }).click();
  await expect(
    page.getByRole("checkbox", { name: `${first} in the trolley` }),
  ).toBeChecked();
  await expect(offer).toHaveCount(0);

  await page.getByRole("checkbox", { name: `${last} in the trolley` }).click();
  await expect(offer).toBeVisible();
  const listPath = new URL(page.url()).pathname;
  await page
    .getByRole("region", { name: /^Notifications/ })
    .getByRole("button", { name: "Archive" })
    .click();

  await expect(page).toHaveURL(/\/shop$/);
  await expect(
    page.getByRole("button", { name: "Make from plan" }),
  ).toBeVisible();
  await expect(page.locator(`a[href="${listPath}"]`)).toHaveCount(0);
});

test("Download saves the unticked lines as a text file", async ({ page }) => {
  const toGet = uniqueName("Oats");
  const got = uniqueName("Honey");
  await startEmptyList(page);
  for (const name of [toGet, got]) {
    await page.getByRole("combobox", { name: "Add to this list" }).fill(name);
    await page.getByRole("option", { name: `Add “${name}”` }).click();
  }
  await page.getByRole("checkbox", { name: `${got} in the trolley` }).click();
  await expect(
    page.getByRole("checkbox", { name: `${got} in the trolley` }),
  ).toBeChecked();
  await expect(
    shopLine(page.getByRole("region", { name: "In the trolley" }), got),
  ).toBeVisible();

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
  const text = await readFile(await download.path(), "utf8");
  expect(text).toBe(`${toGet} ×1`);

  await deleteList(page);
});
