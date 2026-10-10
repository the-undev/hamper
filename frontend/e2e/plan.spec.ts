import {
  addLine,
  addMeal,
  centre,
  dayCard,
  drag,
  expect,
  expectCount,
  line,
  mealNamesOn,
  openApp,
  placeOnDay,
  plannedMealRow,
  planView,
  removeFromDay,
  swipeLeft,
  test,
  uniqueName,
} from "./helpers.ts";

/** The given meals' names in the order a day shows them, leaving out any other meal on it. */
async function orderOf(
  page: Parameters<typeof mealNamesOn>[0],
  dayLabel: string,
  mealNames: readonly string[],
): Promise<string[]> {
  return (await mealNamesOn(page, dayLabel)).filter((name) =>
    mealNames.includes(name),
  );
}

test("a meal placed on a day can be renamed, reset and removed there", async ({
  page,
}) => {
  const meal = uniqueName("Chilli");
  const beans = uniqueName("Beans");
  const rice = uniqueName("Rice");
  await openApp(page, "/meals");
  await addMeal(page, meal, [beans, rice]);
  const day = await placeOnDay(page, meal);

  const row = plannedMealRow(page, meal, day);
  await expect(row).toContainText(`${beans}, ${rice}`);
  await row.click();

  await expect(page.getByRole("heading", { name: day })).toBeVisible();
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
  await expect(plannedMealRow(page, renamed, day)).toBeVisible();
  await plannedMealRow(page, renamed, day).click();
  await page.getByRole("button", { name: "Remove from day" }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(plannedMealRow(page, renamed, day)).toHaveCount(0);
});

test("adding a meal is a screen with the box at the top", async ({ page }) => {
  const meal = uniqueName("Dhal");
  const lentils = uniqueName("Lentils");
  const adHoc = uniqueName("Takeaway");
  await openApp(page, "/meals");
  await addMeal(page, meal, [lentils]);
  await page.goto("/plan");
  await planView(page, "Meals");
  const add = page.getByRole("link", { name: /^Add a meal to / }).first();
  const day = (await add.getAttribute("aria-label"))?.replace(
    "Add a meal to ",
    "",
  );

  await add.click();

  await expect(page).toHaveURL(/\/plan\/pick\/\d+$/);
  await expect(
    page.getByRole("heading", { name: `Add a meal to ${day}` }),
  ).toBeVisible();
  const box = page.getByRole("textbox", { name: "Meal" });
  await expect(box).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // The box sits at the top of the content, right under the header.
  const headerBox = await page.getByRole("banner").boundingBox();
  const boxBox = await box.boundingBox();
  expect(boxBox?.y ?? 0).toBeLessThan((headerBox?.height ?? 0) + 24);
  const library = page.getByRole("list", { name: "Library" });
  await expect(
    library.getByRole("button", { name: meal }).getByText(lentils),
  ).toBeVisible();

  await box.fill(adHoc);
  await expect(library.getByRole("button", { name: meal })).toHaveCount(0);
  await expect(
    page
      .getByRole("list", { name: "Or a meal of its own" })
      .getByRole("button", { name: `Use “${adHoc}” as it is` }),
  ).toBeVisible();
  await box.press("Enter");

  await expect(page).toHaveURL(/\/plan\/meal\/[^/]+$/);
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(adHoc);
  await page.getByRole("button", { name: "Remove from day" }).click();
  await expect(page).toHaveURL(/\/plan$/);

  const placedDay = await placeOnDay(page, meal);
  await removeFromDay(page, meal, placedDay);
});

test("the Meal screen adds its meal to a day chosen from a sheet", async ({
  page,
}) => {
  const meal = uniqueName("Paella");
  await openApp(page, "/meals");
  await addMeal(page, meal, []);

  await page.getByRole("button", { name: "Add to a day" }).click();
  const sheet = page.getByRole("dialog", { name: "Add to a day" });
  const secondDay = sheet.getByRole("button").nth(1);
  const day = (await secondDay.locator("b").textContent()) ?? "";
  await secondDay.click();

  await expect(sheet).toHaveCount(0);
  await expect(page.getByText("On 1 day", { exact: true })).toBeVisible();
  await page.goto("/plan");
  await expect(plannedMealRow(page, meal, day)).toBeVisible();
  await removeFromDay(page, meal, day);
});

test("Done stays above the tabs on a long day and goes back", async ({
  page,
}) => {
  test.skip(!test.info().project.use.hasTouch, "a phone's screen is short");
  const meal = uniqueName("Feast");
  await openApp(page, "/meals");
  await addMeal(page, meal, []);
  const day = await placeOnDay(page, meal);
  await plannedMealRow(page, meal, day).click();
  for (let count = 0; count < 12; count += 1) {
    await addLine(page, "Add an item for this day", uniqueName("Spice"));
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    ),
  ).toBe(true);
  const done = page
    .getByRole("group", { name: "Screen actions" })
    .getByRole("button", { name: "Done" });
  await expect(done).toBeInViewport({ ratio: 1 });
  const doneBox = await done.boundingBox();
  const tabsBox = await page
    .getByRole("navigation", { name: "Tabs" })
    .boundingBox();
  expect((doneBox?.y ?? 0) + (doneBox?.height ?? 0)).toBeLessThanOrEqual(
    tabsBox?.y ?? 0,
  );

  await done.tap();
  await expect(plannedMealRow(page, meal, day)).toBeVisible();
  await removeFromDay(page, meal, day);
});

test("a hold anywhere on a meal lifts it onto another day on a phone", async ({
  page,
}) => {
  test.skip(!test.info().project.use.hasTouch, "a hold needs a finger");
  const first = uniqueName("Soup");
  const second = uniqueName("Stew");
  await openApp(page, "/meals");
  await addMeal(page, first, []);
  await addMeal(page, second, []);
  const firstDay = await placeOnDay(page, first, 0);
  const secondDay = await placeOnDay(page, second, 1);

  // A finger lifts the meal after a 250 ms hold; "Add a meal" takes a drop at the end of its day.
  await drag(
    page,
    await centre(plannedMealRow(page, first, firstDay)),
    await centre(
      dayCard(page, secondDay).getByRole("link", { name: /^Add a meal to / }),
    ),
    300,
  );

  await expect(plannedMealRow(page, first, secondDay)).toBeVisible();
  await expect(plannedMealRow(page, first, firstDay)).toHaveCount(0);
  expect(await orderOf(page, secondDay, [first, second])).toEqual([
    second,
    first,
  ]);
  // dnd-kit swallows every click for 50 ms after a drop, which no hand is quick enough to meet.
  await page.waitForTimeout(100);
  await removeFromDay(page, first, secondDay);
  await removeFromDay(page, second, secondDay);
});

test("a mouse drag reorders a day, showing where it lands without moving the page", async ({
  page,
}) => {
  test.skip(!!test.info().project.use.hasTouch, "a mouse drag is a desktop's");
  const first = uniqueName("Hash");
  const second = uniqueName("Bake");
  await openApp(page, "/meals");
  await addMeal(page, first, []);
  await addMeal(page, second, []);
  const day = await placeOnDay(page, first);
  await placeOnDay(page, second);
  expect(await orderOf(page, day, [first, second])).toEqual([first, second]);
  const from = await centre(plannedMealRow(page, first, day));
  const secondCentre = await centre(plannedMealRow(page, second, day));
  // The lower half of a row drops after it.
  const to = { x: secondCentre.x, y: secondCentre.y + 15 };
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
  await expect(dayCard(page, day).locator("[data-drop-line]")).toHaveCount(1);
  await page.mouse.up();
  await expect
    .poll(() => orderOf(page, day, [first, second]))
    .toEqual([second, first]);
  heights.push(await scrollHeight());

  expect(heights).toEqual(heights.map(() => before));
  await page.waitForTimeout(100);
  await removeFromDay(page, first, day);
  await removeFromDay(page, second, day);
});

test("a swipe removes one meal from a day on a phone", async ({ page }) => {
  test.skip(!test.info().project.use.hasTouch, "a swipe needs a finger");
  const meal = uniqueName("Curry");
  const other = uniqueName("Rice pudding");
  await openApp(page, "/meals");
  await addMeal(page, meal, []);
  await addMeal(page, other, []);
  const day = await placeOnDay(page, meal);
  await placeOnDay(page, other);

  await swipeLeft(page, plannedMealRow(page, meal, day));
  await page
    .getByRole("button", { name: `Remove ${meal} from ${day}`, exact: true })
    .click();

  await expect(plannedMealRow(page, meal, day)).toHaveCount(0);
  await expect(plannedMealRow(page, other, day)).toBeVisible();
  await removeFromDay(page, other, day);
});

test("the Remove action opens by keyboard focus on a desktop", async ({
  page,
}) => {
  test.skip(!!test.info().project.use.hasTouch, "a keyboard is a desktop's");
  const meal = uniqueName("Pie");
  await openApp(page, "/meals");
  await addMeal(page, meal, []);
  const day = await placeOnDay(page, meal);

  await page
    .getByRole("button", { name: `Move ${meal} from ${day}`, exact: true })
    .focus();
  await page.keyboard.press("Tab");
  const remove = page.getByRole("button", {
    name: `Remove ${meal} from ${day}`,
    exact: true,
  });
  await expect(remove).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(plannedMealRow(page, meal, day)).toHaveCount(0);
});

test("the views slide and the extras list is edited on Extras", async ({
  page,
}) => {
  const item = uniqueName("Coffee");
  await openApp(page, "/plan");
  const track = page.locator("[data-plan-track]");
  await expect(track).not.toHaveAttribute("style", /translateX/);

  if (test.info().project.use.hasTouch) {
    await swipeLeft(page, page.getByText(/^Starts /));
  } else {
    await planView(page, "Extras");
  }
  await expect(track).toHaveAttribute("style", /translateX\(-50%\)/);
  await expect(page.getByRole("tab", { name: "Extras" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await addLine(page, "Add to extras", item);
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

test("the suggestions float over the extras list without moving it", async ({
  page,
}) => {
  const first = uniqueName("Olive");
  const second = uniqueName("Olive");
  await openApp(page, "/plan");
  await planView(page, "Extras");
  await addLine(page, "Add to extras", first);
  await addLine(page, "Add to extras", second);
  const input = page.getByRole("combobox", { name: "Add to extras" });
  const extrasList = page.locator('[data-plan-view="items"]').getByRole("list");
  const firstRow = extrasList.getByRole("listitem").first();

  await input.focus();
  const before = await centre(firstRow);
  await input.fill(first.slice(0, -1));
  const suggestions = page.getByRole("listbox", { name: "Suggestions" });
  await expect(suggestions.getByRole("option").first()).toBeVisible();

  expect(await centre(firstRow)).toEqual(before);
  const suggestionsBox = await suggestions.boundingBox();
  const listBox = await extrasList.boundingBox();
  if (!suggestionsBox || !listBox) {
    throw new Error("The suggestions or the list has no box");
  }
  expect(suggestionsBox.y).toBeLessThan(listBox.y + listBox.height);
  expect(suggestionsBox.y + suggestionsBox.height).toBeGreaterThan(listBox.y);

  await page.keyboard.press("Escape");
  await expect(suggestions).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("");
  for (const name of [first, second]) {
    await swipeLeft(page, line(page, name).getByText(name, { exact: true }));
    await page
      .getByRole("button", { name: `Remove ${name}`, exact: true })
      .click();
    await expect(line(page, name)).toHaveCount(0);
  }
});

test("Enter adds what was typed beside a longer name it is a prefix of", async ({
  page,
}) => {
  test.skip(!!test.info().project.use.hasTouch, "a keyboard is a desktop's");
  const longer = uniqueName("Banana");
  const typed = longer.slice(0, -1);
  await openApp(page, "/plan");
  await planView(page, "Extras");
  await addLine(page, "Add to extras", longer);

  await page.getByRole("combobox", { name: "Add to extras" }).fill(typed);
  await page.keyboard.press("Enter");

  await expect(line(page, typed)).toBeVisible();
  await expect(line(page, longer)).toBeVisible();
  for (const name of [typed, longer]) {
    await swipeLeft(page, line(page, name).getByText(name, { exact: true }));
    await page
      .getByRole("button", { name: `Remove ${name}`, exact: true })
      .click();
    await expect(line(page, name)).toHaveCount(0);
  }
});

test("the header keeps its height when the view switches", async ({ page }) => {
  await openApp(page, "/plan");
  await planView(page, "Meals");
  const header = page.getByRole("banner");
  const mealsBox = await header.boundingBox();

  await planView(page, "Extras");
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
  await planView(page, "Extras");
  await addLine(page, "Add to extras", once);
  await addLine(page, "Add to extras", weekly);
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
    .getByRole("alertdialog")
    .getByRole("button", { name: "Cancel" })
    .click();
  await expect(startDate).toHaveValue(before);

  await startNewPlan.click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Start new plan" })
    .click();
  const expected = new Date(`${before}T00:00:00Z`);
  expected.setUTCDate(expected.getUTCDate() + lengthDays);
  await expect(startDate).toHaveValue(expected.toISOString().slice(0, 10));

  await planView(page, "Extras");
  await expect(line(page, once)).toHaveCount(0);
  await expect(line(page, weekly)).toBeVisible();
  await swipeLeft(page, line(page, weekly).getByText(weekly, { exact: true }));
  await page.getByRole("button", { name: `Remove ${weekly}` }).click();
  await expect(line(page, weekly)).toHaveCount(0);
});
