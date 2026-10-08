import {
  addLine,
  addMeal,
  clearDay,
  dayHandle,
  expect,
  line,
  openApp,
  placeOnFirstEmptyDay,
  planView,
  secondDevice,
  statusBar,
  swipeLeft,
  test,
  uniqueName,
} from "./helpers.ts";

test("a second device sees a placed meal without a reload", async ({
  page,
  browser,
}) => {
  const meal = uniqueName("Lasagne");
  const other = await secondDevice(browser);
  const otherPage = await other.newPage();
  await openApp(otherPage, "/plan");

  await openApp(page, "/meals");
  await addMeal(page, meal, []);
  const day = await placeOnFirstEmptyDay(page, meal);

  await expect(dayHandle(otherPage, meal, day)).toBeVisible({ timeout: 5000 });
  await other.close();
  await clearDay(page, day);
});

test("the pending count shows after an edit and clears once sent", async ({
  page,
}) => {
  const item = uniqueName("Tea");
  await openApp(page, "/plan");
  await planView(page, "Items");
  await page.getByRole("textbox", { name: "Add an item" }).fill(item);
  await page.getByRole("button", { name: `Add “${item}”` }).click();

  await expect
    .poll(() => statusBar(page), { intervals: [20] })
    .toMatch(/^\d+ changes? to send$/);
  await expect.poll(() => statusBar(page), { timeout: 3000 }).toBeNull();

  await swipeLeft(page, line(page, item).getByText(item, { exact: true }));
  await page.getByRole("button", { name: `Remove ${item}` }).click();
  await expect(line(page, item)).toHaveCount(0);
});

test("an edit made offline shows at once and reaches another device on reconnect", async ({
  page,
  context,
  browser,
}) => {
  const item = uniqueName("Butter");
  const other = await secondDevice(browser);
  const otherPage = await other.newPage();
  await openApp(otherPage, "/plan");
  await planView(otherPage, "Items");

  await openApp(page, "/plan");
  await planView(page, "Items");
  await context.setOffline(true);
  await addLine(page, "Add an item", item);
  await expect
    .poll(() => statusBar(page))
    .toBe("Offline. Changes are kept on this phone.");
  await expect(line(otherPage, item)).toHaveCount(0);

  await context.setOffline(false);
  await expect.poll(() => statusBar(page), { timeout: 5000 }).toBeNull();
  await expect(line(otherPage, item)).toBeVisible({ timeout: 5000 });
  await other.close();

  await swipeLeft(page, line(page, item).getByText(item, { exact: true }));
  await page.getByRole("button", { name: `Remove ${item}` }).click();
  await expect(line(page, item)).toHaveCount(0);
});
