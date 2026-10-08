import {
  type Browser,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

let nameCount = 0;

/** A name no other test uses, though they share one database: the prefix, the time and a counter. */
export function uniqueName(prefix: string): string {
  nameCount += 1;
  return `${prefix} ${Date.now().toString(36)}${nameCount}`;
}

/** Opens a path and waits until the first sync has brought the plan. */
export async function openApp(page: Page, path: string): Promise<void> {
  await page.goto("/plan");
  await expect(page.getByText(/^Starts /)).toBeVisible();
  if (path !== "/plan") {
    await page.goto(path);
  }
}

/** Opens one of the four tabs. */
export async function tab(page: Page, name: string): Promise<void> {
  await page
    .getByRole("navigation", { name: "Tabs" })
    .getByRole("link", { name })
    .click();
}

/** Picks a view of the Plan screen by its segmented control. */
export async function planView(
  page: Page,
  name: "Meals" | "Items",
): Promise<void> {
  await page.getByRole("radio", { name }).check();
}

/** Adds a meal to the library with one line per item name, and leaves the page on the meal. */
export async function addMeal(
  page: Page,
  name: string,
  lines: readonly string[],
): Promise<void> {
  await page.goto("/meals");
  await page
    .getByRole("searchbox", { name: "Search or add a meal" })
    .fill(name);
  await page
    .getByRole("button", { name: `Add “${name}” as a new meal` })
    .click();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(name);
  for (const line of lines) {
    await addLine(page, "Add an item to this meal", line);
  }
}

/** Types a new item's name into a type-ahead and takes the row that creates it, then waits for its line. */
export async function addLine(
  page: Page,
  typeAheadLabel: string,
  itemName: string,
): Promise<void> {
  await page.getByRole("textbox", { name: typeAheadLabel }).fill(itemName);
  await page.getByRole("button", { name: `Add “${itemName}”` }).click();
  await expect(line(page, itemName)).toBeVisible();
}

/** The list row of a line by its item's name, found by its + button. */
export function line(page: Page, itemName: string): Locator {
  return page.getByRole("listitem").filter({
    has: page.getByRole("button", {
      name: `One more ${itemName}`,
      exact: true,
    }),
  });
}

/** Places a library meal on the plan's first empty day and returns that day's label, as "Thu 8 Oct". */
export async function placeOnFirstEmptyDay(
  page: Page,
  mealName: string,
): Promise<string> {
  await page.goto("/plan");
  await planView(page, "Meals");
  const pick = page.getByRole("button", { name: /^Pick a meal for / }).first();
  const pickLabel = await pick.getAttribute("aria-label");
  const dayLabel = pickLabel?.replace("Pick a meal for ", "") ?? "";
  await pick.click();
  await page.getByRole("textbox", { name: "Meal" }).fill(mealName);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: mealName })
    .first()
    .click();
  await expect(dayHandle(page, mealName, dayLabel)).toBeVisible();
  return dayLabel;
}

/** The drag handle of a filled day, which names the meal and the day. */
export function dayHandle(
  page: Page,
  mealName: string,
  dayLabel: string,
): Locator {
  return page.getByRole("button", {
    name: `Move ${mealName} from ${dayLabel}`,
    exact: true,
  });
}

/** Clears a day of the plan through its Clear action, reached by keyboard focus. */
export async function clearDayByFocus(
  page: Page,
  dayLabel: string,
): Promise<void> {
  const clear = page.getByRole("button", {
    name: `Clear ${dayLabel}`,
    exact: true,
  });
  await clear.focus();
  await clear.press("Enter");
  await expect(
    page.getByRole("button", {
      name: `Pick a meal for ${dayLabel}`,
      exact: true,
    }),
  ).toBeVisible();
}

/** The sync bar's text under the header, or null when it is not showing. */
export async function statusBar(page: Page): Promise<string | null> {
  const bar = page
    .getByRole("status")
    .filter({ hasText: /^(Offline\.|\d+ changes? to send)/ });
  if ((await bar.count()) === 0) {
    return null;
  }
  return bar.first().textContent();
}

/** A touch point for the DevTools protocol. */
interface Point {
  x: number;
  y: number;
}

/** Sends one touch event through the DevTools protocol, which Chromium turns into real touch and pointer events. */
async function touch(
  page: Page,
  type: "touchStart" | "touchMove" | "touchEnd",
  point: Point,
): Promise<void> {
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" ? [] : [{ x: point.x, y: point.y }],
  });
  await session.detach();
}

/** Moves a pointer from one point to another: a finger on a touch project, the mouse otherwise; a hold waits before moving. */
export async function drag(
  page: Page,
  from: Point,
  to: Point,
  holdMs: number,
): Promise<void> {
  const steps = 12;
  const at = (step: number): Point => ({
    x: from.x + ((to.x - from.x) * step) / steps,
    y: from.y + ((to.y - from.y) * step) / steps,
  });
  if (test.info().project.use.hasTouch) {
    await touch(page, "touchStart", from);
    if (holdMs > 0) {
      await page.waitForTimeout(holdMs);
    }
    for (let step = 1; step <= steps; step += 1) {
      await touch(page, "touchMove", at(step));
    }
    await touch(page, "touchEnd", to);
    return;
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  if (holdMs > 0) {
    await page.waitForTimeout(holdMs);
  }
  for (let step = 1; step <= steps; step += 1) {
    const point = at(step);
    await page.mouse.move(point.x, point.y);
  }
  await page.mouse.up();
}

/** The centre of an element on the page. */
export async function centre(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("The element has no box to drag");
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Swipes a row left from just right of its middle, clear of a tick box, a handle or a text box on its edges. */
export async function swipeLeft(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("The row has no box to swipe");
  }
  const y = box.y + box.height / 2;
  await drag(
    page,
    { x: box.x + box.width * 0.55, y },
    { x: box.x + box.width * 0.05, y },
    0,
  );
}

/** A second browser on the same server, with the project's device. */
export async function secondDevice(browser: Browser): Promise<BrowserContext> {
  const {
    baseURL,
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
  } = test.info().project.use;
  return browser.newContext({
    baseURL,
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
  });
}
