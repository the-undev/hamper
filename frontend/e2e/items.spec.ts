import type { Page } from "@playwright/test";
import {
  addMeal,
  clearDay,
  expect,
  expectCount,
  line,
  openApp,
  placeOnFirstEmptyDay,
  planView,
  swipeLeft,
  test,
  uniqueName,
} from "./helpers.ts";

/** Opens an item's editor from More's Items list. */
async function openItem(page: Page, itemName: string): Promise<void> {
  await page.goto("/more/items");
  await page.getByRole("searchbox", { name: "Find an item" }).fill(itemName);
  await page.getByRole("link", { name: new RegExp(`^${itemName}`) }).click();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(
    itemName,
  );
}

test("a renamed item shows its new name on a meal, a day and the wanted list", async ({
  page,
}) => {
  const meal = uniqueName("Porridge");
  const item = uniqueName("Oats");
  const renamed = `${item} rolled`;
  await openApp(page, "/meals");
  await addMeal(page, meal, [item]);
  const mealUrl = page.url();
  const day = await placeOnFirstEmptyDay(page, meal);
  await planView(page, "Items");
  const addWanted = page.getByRole("textbox", { name: "Add an item" });
  await addWanted.fill(item);
  await addWanted.press("Enter");
  await expect(line(page, item)).toBeVisible();

  await openItem(page, item);
  const name = page.getByRole("textbox", { name: "Name" });
  await name.fill(renamed);
  await name.press("Enter");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByRole("link", { name: new RegExp(`^${renamed}`) }),
  ).toBeVisible();

  await page.goto(mealUrl);
  await expect(line(page, renamed)).toBeVisible();
  await page.goto("/plan");
  await planView(page, "Meals");
  await expect(page.getByRole("link", { name: meal })).toContainText(renamed);
  await planView(page, "Items");
  await expect(line(page, renamed)).toBeVisible();

  await swipeLeft(
    page,
    line(page, renamed).getByText(renamed, { exact: true }),
  );
  await page.getByRole("button", { name: `Remove ${renamed}` }).click();
  await expect(line(page, renamed)).toHaveCount(0);
  await clearDay(page, day);
});

test("merging an item moves its lines onto the other and combines counts", async ({
  page,
}) => {
  const meal = uniqueName("Omelette");
  const source = uniqueName("Eggs free range");
  const target = uniqueName("Eggs");
  await openApp(page, "/meals");
  await addMeal(page, meal, [source, target]);
  const mealUrl = page.url();

  await openItem(page, source);
  await page.getByRole("textbox", { name: "Merge into" }).fill(target);
  await page.getByRole("button", { name: target, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Merge" }).click();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(target);

  await page.goto(mealUrl);
  await expectCount(line(page, target), 2);
  await expect(line(page, source)).toHaveCount(0);
});

test("deleting an item removes its lines", async ({ page }) => {
  const meal = uniqueName("Salad");
  const item = uniqueName("Rocket");
  await openApp(page, "/meals");
  await addMeal(page, meal, [item]);
  const mealUrl = page.url();

  await openItem(page, item);
  await page.getByRole("button", { name: "Delete" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("heading", { name: "Items" })).toBeVisible();

  await page.goto(mealUrl);
  await expect(page.getByText("No items on this meal yet")).toBeVisible();
  await expect(line(page, item)).toHaveCount(0);
});
