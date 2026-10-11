import {
  type Browser,
  type BrowserContext,
  test as base,
  type CDPSession,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

export { expect };

/** Playwright's test, which after each test waits until the page has sent every change, so the next test starts from the server's state. */
export const test = base.extend<{ sentEverything: undefined }>({
  sentEverything: [
    async ({ page }, use) => {
      await use(undefined);
      // A closed context loses its outbox, so an edit not yet sent would never reach the server.
      await expect.poll(() => syncState(page)).toBeNull();
    },
    { auto: true },
  ],
});

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

/** Picks a view of the Plan screen by its tabs. */
export async function planView(
  page: Page,
  name: "Meals" | "Extras",
): Promise<void> {
  const viewTab = page
    .getByRole("tablist", { name: "Plan view" })
    .getByRole("tab", { name });
  await viewTab.click();
  await expect(viewTab).toHaveAttribute("aria-selected", "true");
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
  await page.getByRole("combobox", { name: typeAheadLabel }).fill(itemName);
  await page.getByRole("option", { name: `Add “${itemName}”` }).click();
  await expect(line(page, itemName)).toBeVisible();
}

/** The list row of a line by its item's name, found by its + button, on the page or within a section of it. */
export function line(scope: Page | Locator, itemName: string): Locator {
  // The inner locator is matched inside each row, so it starts from the page.
  const page = "page" in scope ? scope.page() : scope;
  return scope.getByRole("listitem").filter({
    has: page.getByRole("button", {
      name: `One more ${itemName}`,
      exact: true,
    }),
  });
}

/** Adds a library meal to a day through the picker screen, the first day unless another is named by its index, and returns that day's label, as "Thu 8 Oct". */
export async function placeOnDay(
  page: Page,
  mealName: string,
  dayIndex = 0,
): Promise<string> {
  await page.goto("/plan");
  await planView(page, "Meals");
  const add = page.getByRole("link", { name: /^Add a meal to / }).nth(dayIndex);
  const addLabel = await add.getAttribute("aria-label");
  const dayLabel = addLabel?.replace("Add a meal to ", "") ?? "";
  await add.click();
  await page.getByRole("textbox", { name: "Meal" }).fill(mealName);
  await page
    .getByRole("list", { name: "Library" })
    .getByRole("button", { name: mealName })
    .first()
    .click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(plannedMealRow(page, mealName, dayLabel)).toBeVisible();
  return dayLabel;
}

/** A day's card on the Plan, by its date label. */
export function dayCard(page: Page, dayLabel: string): Locator {
  return page.getByRole("listitem", { name: dayLabel, exact: true });
}

/** A planned meal's link on the Plan, which shows its name and lines, within its day's card. */
export function plannedMealRow(
  page: Page,
  mealName: string,
  dayLabel: string,
): Locator {
  return dayCard(page, dayLabel).getByRole("link", { name: mealName });
}

/** The names of a day's planned meals in their order on the Plan. */
export async function mealNamesOn(
  page: Page,
  dayLabel: string,
): Promise<string[]> {
  return dayCard(page, dayLabel)
    .getByRole("link")
    .locator("b")
    .allTextContents();
}

/** Removes a planned meal through its Remove action: a swipe and a tap on a phone, keyboard focus and Enter on a desktop. */
export async function removeFromDay(
  page: Page,
  mealName: string,
  dayLabel: string,
): Promise<void> {
  await planView(page, "Meals");
  const remove = page.getByRole("button", {
    name: `Remove ${mealName} from ${dayLabel}`,
    exact: true,
  });
  if (test.info().project.use.hasTouch) {
    await swipeLeft(page, plannedMealRow(page, mealName, dayLabel));
    await remove.click();
  } else {
    await remove.focus();
    await expect(remove).toBeFocused();
    await page.keyboard.press("Enter");
  }
  await expect(plannedMealRow(page, mealName, dayLabel)).toHaveCount(0);
}

/** The name of the header's sync indicator: "Syncing", "N changes to send" or the offline sentence, or null once everything is sent. */
export async function syncState(page: Page): Promise<string | null> {
  // evaluateAll does not wait, so a page without the app, a skipped test's blank one, reads as null.
  return page
    .getByRole("banner")
    .getByRole("status")
    .evaluateAll((slots) => slots[0]?.getAttribute("aria-label") ?? null);
}

/** A point on the page, in CSS pixels. */
interface Point {
  x: number;
  y: number;
}

/** An element's box on the page. */
interface Box extends Point {
  width: number;
  height: number;
}

/** Sends one touch event through the DevTools protocol, which Chromium turns into real touch and pointer events. */
async function touch(
  session: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd",
  point: Point,
): Promise<void> {
  await session.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: type === "touchEnd" ? [] : [{ x: point.x, y: point.y }],
  });
}

/** Waits until no day card or row on the Plan is still sliding to its place. */
async function plannedRowsSettled(page: Page): Promise<void> {
  // Two frames give the page time to render the last move and start any slide it causes.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          !(
            animation.effect instanceof KeyframeEffect &&
            animation.effect.target?.closest("[data-position]")
          ),
      ),
  );
}

/** A pointer held down on the page: a finger on a touch project, the mouse otherwise. */
export interface Press {
  /** Moves the pointer to a point in twelve steps, then waits for the Plan's rows to settle. */
  moveTo(to: Point): Promise<void>;
  /** Moves the pointer to a point in twelve steps without waiting for anything to settle. */
  sweepTo(to: Point): Promise<void>;
  /** Lifts the pointer where it is. */
  release(): Promise<void>;
}

/** Presses a pointer at a point, a finger on a touch project and the mouse otherwise, and holds it there for a while. */
export async function press(
  page: Page,
  from: Point,
  holdMs: number,
): Promise<Press> {
  const steps = 12;
  let at = from;
  const pathTo = (to: Point): Point[] =>
    Array.from({ length: steps }, (_, step) => ({
      x: at.x + ((to.x - at.x) * (step + 1)) / steps,
      y: at.y + ((to.y - at.y) * (step + 1)) / steps,
    }));
  if (test.info().project.use.hasTouch) {
    // One session for the whole gesture: the protocol tracks the touch per session.
    const session = await page.context().newCDPSession(page);
    await touch(session, "touchStart", from);
    if (holdMs > 0) {
      await page.waitForTimeout(holdMs);
    }
    const sweepTo = async (to: Point) => {
      for (const point of pathTo(to)) {
        await touch(session, "touchMove", point);
      }
      at = to;
    };
    return {
      sweepTo,
      moveTo: async (to) => {
        await sweepTo(to);
        await plannedRowsSettled(page);
      },
      release: async () => {
        await touch(session, "touchEnd", at);
        await session.detach();
      },
    };
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  if (holdMs > 0) {
    await page.waitForTimeout(holdMs);
  }
  const sweepTo = async (to: Point) => {
    for (const point of pathTo(to)) {
      await page.mouse.move(point.x, point.y);
    }
    at = to;
  };
  return {
    sweepTo,
    moveTo: async (to) => {
      await sweepTo(to);
      await plannedRowsSettled(page);
    },
    release: () => page.mouse.up(),
  };
}

/** Moves a pointer from one point to another: a finger on a touch project, the mouse otherwise; a hold waits before moving. */
export async function drag(
  page: Page,
  from: Point,
  to: Point,
  holdMs: number,
): Promise<void> {
  const held = await press(page, from, holdMs);
  await held.moveTo(to);
  await held.release();
}

/** Where an element sits once the page has stopped moving: the same box twice running. */
async function settledBox(locator: Locator): Promise<Box> {
  // Playwright's own actions can scroll the Plan's clipped track sideways; bring the element back into view first.
  await locator.scrollIntoViewIfNeeded();
  let lastBox: Box | null = null;
  let settled: Box | null = null;
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        settled =
          box && lastBox && JSON.stringify(box) === JSON.stringify(lastBox)
            ? box
            : null;
        lastBox = box;
        return settled !== null;
      },
      { intervals: [50] },
    )
    .toBe(true);
  if (!settled) {
    throw new Error("The element never settled");
  }
  return settled;
}

/** The centre of an element once the page has stopped moving. */
export async function centre(locator: Locator): Promise<Point> {
  const box = await settledBox(locator);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Swipes left across most of an element, which should sit clear of a row's tick box, handle and text boxes. */
export async function swipeLeft(page: Page, locator: Locator): Promise<void> {
  const box = await settledBox(locator);
  const y = box.y + box.height / 2;
  await drag(
    page,
    { x: box.x + box.width * 0.9, y },
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

/** Waits for a row's count, the number between its − and +. */
export async function expectCount(row: Locator, count: number): Promise<void> {
  await expect(row).toHaveText(new RegExp(`−${count}\\+`));
}
