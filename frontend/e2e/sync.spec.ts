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
  swipeLeft,
  syncState,
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
  await page.getByRole("option", { name: `Add “${item}”` }).click();

  await expect
    .poll(() => syncState(page), { intervals: [20] })
    .toMatch(/^\d+ changes? to send$/);
  await expect.poll(() => syncState(page), { timeout: 3000 }).toBeNull();

  await swipeLeft(page, line(page, item).getByText(item, { exact: true }));
  await page.getByRole("button", { name: `Remove ${item}` }).click();
  await expect(line(page, item)).toHaveCount(0);
});

test("the header and the column stay put while changes wait and once they are sent", async ({
  page,
}) => {
  const item = uniqueName("Jam");
  await openApp(page, "/plan");
  await planView(page, "Items");
  const geometry = () =>
    page.evaluate(() => ({
      state:
        document
          .querySelector("header [role=status]")
          ?.getAttribute("aria-label") ?? null,
      headerHeight: document.querySelector("header")?.getBoundingClientRect()
        .height,
      mainTop: document.querySelector("main")?.getBoundingClientRect().top,
    }));
  const before = await geometry();
  expect(before.state).toBeNull();

  await page.getByRole("textbox", { name: "Add an item" }).fill(item);
  await page.getByRole("option", { name: `Add “${item}”` }).click();
  let waiting = before;
  await expect
    .poll(
      async () => {
        waiting = await geometry();
        return waiting.state;
      },
      { intervals: [20] },
    )
    .toMatch(/^\d+ changes? to send$/);
  await expect.poll(() => syncState(page), { timeout: 3000 }).toBeNull();
  const after = await geometry();

  expect(waiting.headerHeight).toBe(before.headerHeight);
  expect(waiting.mainTop).toBe(before.mainTop);
  expect(after.headerHeight).toBe(before.headerHeight);
  expect(after.mainTop).toBe(before.mainTop);

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
    .poll(() => syncState(page))
    .toBe("Offline. Changes are kept on this phone.");
  await expect(line(otherPage, item)).toHaveCount(0);

  await context.setOffline(false);
  await expect.poll(() => syncState(page), { timeout: 5000 }).toBeNull();
  await expect(line(otherPage, item)).toBeVisible({ timeout: 5000 });
  await other.close();

  await swipeLeft(page, line(page, item).getByText(item, { exact: true }));
  await page.getByRole("button", { name: `Remove ${item}` }).click();
  await expect(line(page, item)).toHaveCount(0);
});
