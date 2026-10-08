import {
  addLine,
  addMeal,
  centre,
  clearDay,
  dayHandle,
  drag,
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

test("a meal placed on a day can be renamed, reset and cleared there", async ({
  page,
}) => {
  const meal = uniqueName("Chilli");
  const beans = uniqueName("Beans");
  const rice = uniqueName("Rice");
  await openApp(page, "/meals");
  await addMeal(page, meal, [beans, rice]);
  const day = await placeOnFirstEmptyDay(page, meal);

  const slotLink = page.getByRole("link", { name: meal });
  await expect(slotLink).toContainText(`${beans}, ${rice}`);
  await slotLink.click();

  await expect(page.getByText(`From the meal ${meal}`)).toBeVisible();
  await line(page, beans)
    .getByRole("button", { name: `One more ${beans}` })
    .click();
  await expectCount(line(page, beans), 2);
  await expect(
    page.getByText(`From the meal ${meal}, changed for this day`),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset to the meal" }).click();
  await expect(
    page.getByText(`From the meal ${meal}`, { exact: true }),
  ).toBeVisible();
  await expectCount(line(page, beans), 1);

  const renamed = `${meal} with cheese`;
  const name = page.getByRole("textbox", { name: "Name" });
  await name.fill(renamed);
  await name.press("Enter");
  await expect(name).toHaveValue(renamed);

  await page.getByRole("button", { name: "Done" }).click();
  await expect(dayHandle(page, renamed, day)).toBeVisible();
  await page.getByRole("link", { name: renamed }).click();
  await page.getByRole("button", { name: "Clear day" }).click();
  await expect(
    page.getByRole("button", { name: `Pick a meal for ${day}`, exact: true }),
  ).toBeVisible();
});

test("a day drags onto another to swap", async ({ page }) => {
  const first = uniqueName("Soup");
  const second = uniqueName("Stew");
  await openApp(page, "/meals");
  await addMeal(page, first, []);
  await addMeal(page, second, []);
  const firstDay = await placeOnFirstEmptyDay(page, first);
  const secondDay = await placeOnFirstEmptyDay(page, second);

  // A phone lifts the day after a 250 ms hold on the handle; a mouse after 8px.
  const holdMs = test.info().project.use.hasTouch ? 300 : 0;
  await drag(
    page,
    await centre(dayHandle(page, first, firstDay)),
    await centre(dayHandle(page, second, secondDay)),
    holdMs,
  );

  await expect(dayHandle(page, first, secondDay)).toBeVisible();
  await expect(dayHandle(page, second, firstDay)).toBeVisible();
  // dnd-kit swallows every click for 50 ms after a drop, which no hand is quick enough to meet.
  await page.waitForTimeout(100);
  await clearDay(page, firstDay);
  await clearDay(page, secondDay);
});

test("the page keeps its height while a day is dragged", async ({ page }) => {
  test.skip(!!test.info().project.use.hasTouch, "a mouse drag is a desktop's");
  const first = uniqueName("Hash");
  const second = uniqueName("Bake");
  await openApp(page, "/meals");
  await addMeal(page, first, []);
  await addMeal(page, second, []);
  const firstDay = await placeOnFirstEmptyDay(page, first);
  const secondDay = await placeOnFirstEmptyDay(page, second);
  const from = await centre(dayHandle(page, first, firstDay));
  const to = await centre(dayHandle(page, second, secondDay));
  const scrollHeight = () =>
    page.evaluate(() => document.documentElement.scrollHeight);
  const before = await scrollHeight();

  const heights: number[] = [];
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(
      from.x + ((to.x - from.x) * step) / 12,
      from.y + ((to.y - from.y) * step) / 12,
    );
    heights.push(await scrollHeight());
  }
  await page.mouse.up();
  await expect(dayHandle(page, first, secondDay)).toBeVisible();
  heights.push(await scrollHeight());

  expect(heights).toEqual(heights.map(() => before));
  await page.waitForTimeout(100);
  await clearDay(page, firstDay);
  await clearDay(page, secondDay);
});

test("a swipe clears a day on a phone", async ({ page }) => {
  test.skip(!test.info().project.use.hasTouch, "a swipe needs a finger");
  const meal = uniqueName("Curry");
  await openApp(page, "/meals");
  await addMeal(page, meal, []);
  const day = await placeOnFirstEmptyDay(page, meal);

  const clear = page.getByRole("button", { name: `Clear ${day}`, exact: true });
  await swipeLeft(page, page.getByRole("link", { name: meal }));
  await clear.click();
  await expect(
    page.getByRole("button", { name: `Pick a meal for ${day}`, exact: true }),
  ).toBeVisible();
});

test("the Clear action opens by keyboard focus on a desktop", async ({
  page,
}) => {
  test.skip(!!test.info().project.use.hasTouch, "a keyboard is a desktop's");
  const meal = uniqueName("Pie");
  await openApp(page, "/meals");
  await addMeal(page, meal, []);
  const day = await placeOnFirstEmptyDay(page, meal);

  await dayHandle(page, meal, day).focus();
  await page.keyboard.press("Tab");
  const clear = page.getByRole("button", { name: `Clear ${day}`, exact: true });
  await expect(clear).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: `Pick a meal for ${day}`, exact: true }),
  ).toBeVisible();
});

test("the views slide and the wanted list is edited on Items", async ({
  page,
}) => {
  const item = uniqueName("Coffee");
  await openApp(page, "/plan");
  const track = page.locator("[data-plan-track]");
  await expect(track).not.toHaveAttribute("style", /translateX/);

  if (test.info().project.use.hasTouch) {
    await swipeLeft(page, page.getByText(/^Starts /));
  } else {
    await planView(page, "Items");
  }
  await expect(track).toHaveAttribute("style", /translateX\(-50%\)/);
  await expect(page.getByRole("radio", { name: "Items" })).toBeChecked();

  await addLine(page, "Add an item", item);
  const row = line(page, item);
  await row.getByRole("button", { name: `One more ${item}` }).click();
  await expectCount(row, 2);
  await row.getByRole("button", { name: `${item}: Once` }).click();
  await expect(
    row.getByRole("button", { name: `${item}: Weekly` }),
  ).toBeVisible();

  await swipeLeft(page, row.getByText(item, { exact: true }));
  await page.getByRole("button", { name: `Remove ${item}` }).click();
  await expect(row).toHaveCount(0);

  await planView(page, "Meals");
  await expect(track).not.toHaveAttribute("style", /translateX/);
});

test("the header keeps its height when the view switches", async ({ page }) => {
  await openApp(page, "/plan");
  await planView(page, "Meals");
  const header = page.getByRole("banner");
  const mealsBox = await header.boundingBox();

  await planView(page, "Items");
  await expect(header.getByLabel("Start date")).toBeVisible();
  const itemsBox = await header.boundingBox();

  expect(itemsBox?.height).toBe(mealsBox?.height);
  await planView(page, "Meals");
});

test("Start new plan moves the start and clears Once lines, after a confirm", async ({
  page,
}) => {
  const once = uniqueName("Bread");
  const weekly = uniqueName("Milk");
  await openApp(page, "/plan");
  await planView(page, "Items");
  await addLine(page, "Add an item", once);
  await addLine(page, "Add an item", weekly);
  await line(page, weekly)
    .getByRole("button", { name: `${weekly}: Once` })
    .click();
  await expect(
    line(page, weekly).getByRole("button", { name: `${weekly}: Weekly` }),
  ).toBeVisible();

  await planView(page, "Meals");
  const startDate = page.getByLabel("Start date");
  const before = await startDate.inputValue();
  const lengthText = await page
    .getByRole("banner")
    .getByText(/^\d+ days$/)
    .textContent();
  const lengthDays = Number(lengthText?.replace(" days", ""));
  const startNewPlan = page.getByRole("button", {
    name: /^Start new plan from /,
  });

  await startNewPlan.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel" })
    .click();
  await expect(startDate).toHaveValue(before);

  await startNewPlan.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start new plan" })
    .click();
  const expected = new Date(`${before}T00:00:00Z`);
  expected.setUTCDate(expected.getUTCDate() + lengthDays);
  await expect(startDate).toHaveValue(expected.toISOString().slice(0, 10));

  await planView(page, "Items");
  await expect(line(page, once)).toHaveCount(0);
  await expect(line(page, weekly)).toBeVisible();
  await swipeLeft(page, line(page, weekly).getByText(weekly, { exact: true }));
  await page.getByRole("button", { name: `Remove ${weekly}` }).click();
  await expect(line(page, weekly)).toHaveCount(0);
});
