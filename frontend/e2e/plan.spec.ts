import {
  addLine,
  addMeal,
  centre,
  dayCard,
  expect,
  expectCount,
  line,
  mealNamesOn,
  openApp,
  placeOnDay,
  plannedMealRow,
  planView,
  press,
  removeFromDay,
  swipeLeft,
  syncState,
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

  const scrollArea = page.locator("[data-scroll-area]");
  await scrollArea.evaluate((area) => area.scrollTo(0, 0));
  expect(
    await scrollArea.evaluate((area) => area.scrollHeight > area.clientHeight),
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
  const addMealRow = dayCard(page, secondDay).getByRole("link", {
    name: /^Add a meal to /,
  });
  const held = await press(
    page,
    await centre(plannedMealRow(page, first, firstDay)),
    300,
  );
  await held.moveTo(await centre(addMealRow));
  // Passing over the upper half of the meal there opened a gap before it, which moved the rows down; aim again.
  await held.moveTo(await centre(addMealRow));

  const gap = dayCard(page, secondDay).locator("[data-gap]");
  await expect(gap).toBeVisible();
  await expect(
    dayCard(page, firstDay).locator("[data-stand-in]"),
  ).toBeVisible();
  const secondBox = await plannedMealRow(page, second, secondDay).boundingBox();
  expect((await gap.boundingBox())?.y).toBeGreaterThan(secondBox?.y ?? 0);
  await held.release();

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

test("a lifted meal moves only up and down and a sideways finger does not reveal Remove", async ({
  page,
}) => {
  test.skip(!test.info().project.use.hasTouch, "a hold needs a finger");
  const meal = uniqueName("Soup");
  await openApp(page, "/meals");
  await addMeal(page, meal, []);
  const day = await placeOnDay(page, meal);
  const row = plannedMealRow(page, meal, day);
  const rowItem = row.locator("xpath=ancestor::li[1]");
  const rowLeft = (await rowItem.boundingBox())?.x ?? 0;
  const from = await centre(row);

  const held = await press(page, from, 300);
  await held.moveTo({ x: from.x + 60, y: from.y });

  const overlay = page.locator("[data-drag-overlay]");
  await expect(overlay).toBeVisible();
  expect((await overlay.boundingBox())?.x).toBeCloseTo(rowLeft, 0);
  await expect(
    row.locator("xpath=ancestor::*[@data-swipe-row][1]/div[1]"),
  ).toHaveCSS("transform", "none");
  await held.release();

  await expect(row).toBeVisible();
  // dnd-kit swallows every click for 50 ms after a drop, which no hand is quick enough to meet.
  await page.waitForTimeout(100);
  await removeFromDay(page, meal, day);
});

test("a mouse drag opens a gap where the meal lands, moving only what is below it", async ({
  page,
}) => {
  test.skip(!!test.info().project.use.hasTouch, "a mouse drag is a desktop's");
  const first = uniqueName("Hash");
  const second = uniqueName("Bake");
  const third = uniqueName("Stew");
  await openApp(page, "/meals");
  for (const name of [first, second, third]) {
    await addMeal(page, name, []);
  }
  const day = await placeOnDay(page, first);
  await placeOnDay(page, second);
  await placeOnDay(page, third);
  const names = [first, second, third];
  expect(await orderOf(page, day, names)).toEqual(names);
  const firstRow = plannedMealRow(page, first, day);
  const rowHeight =
    (await firstRow.locator("xpath=ancestor::li[1]").boundingBox())?.height ??
    0;
  const from = await centre(firstRow);
  const secondBefore = await centre(plannedMealRow(page, second, day));
  const thirdBefore = await centre(plannedMealRow(page, third, day));
  const cardTop = async () => (await dayCard(page, day).boundingBox())?.y;
  const cardTopBefore = await cardTop();

  // The upper half of a row lands before it; the pointer passes slowly over the row between.
  const held = await press(page, from, 0);
  await held.moveTo({ x: thirdBefore.x, y: thirdBefore.y - 15 });

  const thirdRow = plannedMealRow(page, third, day);
  await expect
    .poll(async () => Math.round((await centre(thirdRow)).y - thirdBefore.y))
    .toBe(Math.round(rowHeight));
  const gap = dayCard(page, day).locator("[data-gap]");
  const gapBox = await gap.boundingBox();
  expect(Math.round(gapBox?.height ?? 0)).toBe(Math.round(rowHeight));
  expect(gapBox?.y ?? 0).toBeLessThan(thirdBefore.y - 15);
  expect((gapBox?.y ?? 0) + (gapBox?.height ?? 0)).toBeGreaterThan(
    thirdBefore.y - 15,
  );
  expect(await centre(plannedMealRow(page, second, day))).toEqual(secondBefore);
  expect(await cardTop()).toBe(cardTopBefore);
  // A pointer that stays put keeps the gap where it is.
  await page.waitForTimeout(400);
  expect(Math.round((await centre(thirdRow)).y - thirdBefore.y)).toBe(
    Math.round(rowHeight),
  );

  await held.release();
  await expect
    .poll(() => orderOf(page, day, names))
    .toEqual([second, first, third]);
  await page.waitForTimeout(100);
  for (const name of names) {
    await removeFromDay(page, name, day);
  }
});

test("a dropped meal lands in its gap and does not return to where it came from", async ({
  page,
}) => {
  test.skip(!!test.info().project.use.hasTouch, "a mouse drag is a desktop's");
  const first = uniqueName("Broth");
  const second = uniqueName("Pilaf");
  await openApp(page, "/meals");
  await addMeal(page, first, []);
  await addMeal(page, second, []);
  const firstDay = await placeOnDay(page, first, 0);
  const secondDay = await placeOnDay(page, second, 1);
  const secondCentre = await centre(plannedMealRow(page, second, secondDay));

  const held = await press(
    page,
    await centre(plannedMealRow(page, first, firstDay)),
    0,
  );
  await held.moveTo({ x: secondCentre.x, y: secondCentre.y - 15 });
  await expect(dayCard(page, secondDay).locator("[data-gap]")).toHaveCount(1);
  // Records where the row is once React has handled the release, in the same task, before any store write can finish.
  await page.evaluate((mealName) => {
    const whereIsRow = () => {
      const row = [...document.querySelectorAll("[data-position] li")].find(
        (item) =>
          !item.matches("[data-gap], [data-stand-in]") &&
          item.querySelector("a b")?.textContent === mealName,
      );
      return {
        day: row?.closest("[data-position]")?.querySelector("h2")?.textContent,
        gaps: document.querySelectorAll("[data-gap]").length,
        standIns: document.querySelectorAll("[data-stand-in]").length,
      };
    };
    window.addEventListener(
      "mouseup",
      () =>
        queueMicrotask(() => {
          Object.assign(window, { landedOnRelease: whereIsRow() });
        }),
      { once: true },
    );
    Object.assign(window, { whereIsRow });
  }, first);
  await held.release();

  const landed = await page.evaluate(() => {
    const probe = window as unknown as {
      landedOnRelease: unknown;
      whereIsRow: () => unknown;
    };
    return { onRelease: probe.landedOnRelease, now: probe.whereIsRow() };
  });
  const inTheTargetDay = { day: secondDay, gaps: 0, standIns: 0 };
  expect(landed).toEqual({ onRelease: inTheTargetDay, now: inTheTargetDay });

  await expect.poll(() => syncState(page)).toBe("Synced");
  await expect(plannedMealRow(page, first, secondDay)).toBeVisible();
  await expect(plannedMealRow(page, first, firstDay)).toHaveCount(0);
  await expect(dayCard(page, firstDay).locator("[data-stand-in]")).toHaveCount(
    0,
  );
  expect(await orderOf(page, secondDay, [first, second])).toEqual([
    first,
    second,
  ]);
  await page.waitForTimeout(100);
  await removeFromDay(page, first, secondDay);
  await removeFromDay(page, second, secondDay);
});

/** Records the screen top of each named day card on every frame until the returned function stops it and hands back the tops. */
async function watchCardTops(
  page: Parameters<typeof mealNamesOn>[0],
  dayLabels: readonly string[],
): Promise<() => Promise<Record<string, number[]>>> {
  await page.evaluate((labels) => {
    const tops: Record<string, number[]> = Object.fromEntries(
      labels.map((label) => [label, []]),
    );
    const watch = { tops, running: true };
    const frame = () => {
      for (const card of document.querySelectorAll("[data-position]")) {
        const label = card.querySelector("h2")?.textContent ?? "";
        tops[label]?.push(card.getBoundingClientRect().top);
      }
      if (watch.running) {
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
    Object.assign(window, { cardWatch: watch });
  }, dayLabels);
  return () =>
    page.evaluate(() => {
      const watch = (
        window as unknown as {
          cardWatch: { tops: Record<string, number[]>; running: boolean };
        }
      ).cardWatch;
      watch.running = false;
      return watch.tops;
    });
}

/** Whether a card's tops went from one place to another through at least one place between. */
function slid(tops: readonly number[], from: number, to: number): boolean {
  const low = Math.min(from, to) + 1;
  const high = Math.max(from, to) - 1;
  return (
    Math.abs((tops[0] ?? 0) - from) < 1 &&
    Math.abs((tops.at(-1) ?? 0) - to) < 1 &&
    tops.some((top) => top > low && top < high)
  );
}

test("the days below slide to make room for a gap and slide back when the stand-in goes", async ({
  page,
}) => {
  const first = uniqueName("Tagine");
  const second = uniqueName("Gnocchi");
  await openApp(page, "/meals");
  await addMeal(page, first, []);
  await addMeal(page, second, []);
  const firstDay = await placeOnDay(page, first, 0);
  const secondDay = await placeOnDay(page, second, 1);
  const thirdDay =
    (
      await page
        .getByRole("link", { name: /^Add a meal to / })
        .nth(2)
        .getAttribute("aria-label")
    )?.replace("Add a meal to ", "") ?? "";
  const cardTop = async (dayLabel: string) =>
    (await dayCard(page, dayLabel).boundingBox())?.y ?? 0;
  const rowHeight =
    (
      await plannedMealRow(page, first, firstDay)
        .locator("xpath=ancestor::li[1]")
        .boundingBox()
    )?.height ?? 0;
  const secondTop = await cardTop(secondDay);
  const thirdTop = await cardTop(thirdDay);
  const secondCentre = await centre(plannedMealRow(page, second, secondDay));

  const held = await press(
    page,
    await centre(plannedMealRow(page, first, firstDay)),
    test.info().project.use.hasTouch ? 300 : 0,
  );
  const opening = await watchCardTops(page, [secondDay, thirdDay]);
  await held.moveTo({ x: secondCentre.x, y: secondCentre.y - 15 });
  await expect
    .poll(async () => Math.round(await cardTop(thirdDay)))
    .toBe(Math.round(thirdTop + rowHeight));
  const opened = await opening();
  await expect(dayCard(page, secondDay).locator("[data-gap]")).toHaveCount(1);
  expect(slid(opened[thirdDay] ?? [], thirdTop, thirdTop + rowHeight)).toBe(
    true,
  );
  expect(opened[secondDay]?.every((top) => top === secondTop)).toBe(true);

  const closing = await watchCardTops(page, [secondDay, thirdDay]);
  await held.release();
  await expect
    .poll(async () => Math.round(await cardTop(secondDay)))
    .toBe(Math.round(secondTop - rowHeight));
  await page.waitForTimeout(300);
  const closed = await closing();
  expect(slid(closed[secondDay] ?? [], secondTop, secondTop - rowHeight)).toBe(
    true,
  );
  expect(slid(closed[thirdDay] ?? [], thirdTop + rowHeight, thirdTop)).toBe(
    true,
  );

  await page.waitForTimeout(100);
  await removeFromDay(page, first, secondDay);
  await removeFromDay(page, second, secondDay);
});

/** One frame of the probe: when it was drawn, and each sliding element's identity, slide key and top on the screen. */
interface ProbeFrame {
  time: number;
  tops: [number, string, number][];
}

/** Samples every card, day header and row with a slide key on every frame until the returned function stops it and hands back the frames. */
async function startFrameProbe(
  page: Parameters<typeof mealNamesOn>[0],
): Promise<() => Promise<ProbeFrame[]>> {
  await page.evaluate(() => {
    const identities = new WeakMap<Element, number>();
    let nextIdentity = 0;
    const probe = { frames: [] as ProbeFrame[], running: true };
    const frame = (time: number) => {
      const tops: [number, string, number][] = [];
      for (const element of document.querySelectorAll<HTMLElement>(
        "[data-slide], [data-position] h2",
      )) {
        if (!identities.has(element)) {
          identities.set(element, nextIdentity);
          nextIdentity += 1;
        }
        const key =
          element.dataset.slide ??
          `header-${element.closest<HTMLElement>("[data-position]")?.dataset.position}`;
        tops.push([
          identities.get(element) ?? 0,
          element.hasAttribute("data-gap") ? `gap:${key}` : key,
          element.getBoundingClientRect().top,
        ]);
      }
      probe.frames.push({ time, tops });
      if (probe.running) {
        requestAnimationFrame(frame);
      }
    };
    requestAnimationFrame(frame);
    Object.assign(window, { frameProbe: probe });
  });
  return () =>
    page.evaluate(() => {
      const probe = (
        window as unknown as {
          frameProbe: { frames: ProbeFrame[]; running: boolean };
        }
      ).frameProbe;
      probe.running = false;
      return probe.frames;
    });
}

/** A change of speed no slide makes: which element, its speeds before and after in pixels a frame, and when. */
interface Jump {
  slideKey: string;
  time: number;
  speeds: [number, number];
}

/** Every element that stayed mounted and changed speed by more than 20 pixels a frame from one frame to the next; an eased 200ms slide of two rows changes by about 10. */
function jumpsIn(frames: readonly ProbeFrame[]): Jump[] {
  const jumps: Jump[] = [];
  const speeds = new Map<number, number>();
  for (let at = 1; at < frames.length; at += 1) {
    const previous = frames[at - 1];
    const current = frames[at];
    if (!previous || !current) {
      continue;
    }
    // Speeds are per 60Hz frame, so a dropped frame does not read as a jump.
    const frameShare = (current.time - previous.time) / (1000 / 60);
    const before = new Map(
      previous.tops.map(([identity, , top]) => [identity, top]),
    );
    const seen = new Set<number>();
    for (const [identity, slideKey, top] of current.tops) {
      // The gap moves in one step to where it lands, by design, so only the slides are checked.
      if (slideKey.startsWith("gap:")) {
        continue;
      }
      const was = before.get(identity);
      if (was === undefined) {
        continue;
      }
      seen.add(identity);
      const speed = (top - was) / frameShare;
      const lastSpeed = speeds.get(identity) ?? 0;
      if (Math.abs(speed - lastSpeed) > 20) {
        jumps.push({
          slideKey,
          time: Math.round(current.time),
          speeds: [Math.round(lastSpeed), Math.round(speed)],
        });
      }
      speeds.set(identity, speed);
    }
    for (const identity of speeds.keys()) {
      if (!seen.has(identity)) {
        speeds.delete(identity);
      }
    }
  }
  return jumps;
}

test("no card or row jumps while a meal drags across days and lands", async ({
  page,
}) => {
  const names = [uniqueName("Ramen"), uniqueName("Dal"), uniqueName("Pho")];
  const other = uniqueName("Laksa");
  await openApp(page, "/meals");
  for (const name of [...names, other]) {
    await addMeal(page, name, []);
  }
  const day = await placeOnDay(page, names[0] ?? "", 0);
  await placeOnDay(page, names[1] ?? "", 0);
  await placeOnDay(page, names[2] ?? "", 0);
  const otherDay = await placeOnDay(page, other, 1);
  const [first, second] = names;
  const secondCentre = await centre(plannedMealRow(page, second ?? "", day));
  const otherCentre = await centre(plannedMealRow(page, other, otherDay));
  const otherAddMeal = dayCard(page, otherDay).getByRole("link", {
    name: /^Add a meal to /,
  });

  const stopProbe = await startFrameProbe(page);
  const held = await press(
    page,
    await centre(plannedMealRow(page, first ?? "", day)),
    test.info().project.use.hasTouch ? 300 : 0,
  );
  // A gap within the day, after the second meal.
  await held.sweepTo({ x: secondCentre.x, y: secondCentre.y + 15 });
  // On to the other day while the first slide still runs.
  await held.sweepTo({ x: otherCentre.x, y: otherCentre.y - 15 });
  // To the end of the other day.
  await held.moveTo(await centre(otherAddMeal));
  await held.moveTo(await centre(otherAddMeal));
  await held.release();
  await page.waitForTimeout(600);
  const frames = await stopProbe();

  expect(frames.length).toBeGreaterThan(60);
  expect(jumpsIn(frames)).toEqual([]);
  expect(await orderOf(page, otherDay, [first ?? "", other])).toEqual([
    other,
    first,
  ]);

  await page.waitForTimeout(100);
  await removeFromDay(page, first ?? "", otherDay);
  await removeFromDay(page, second ?? "", day);
  await removeFromDay(page, names[2] ?? "", day);
  await removeFromDay(page, other, otherDay);
});

test("nothing jumps while a meal drags down empty days and back", async ({
  page,
}) => {
  const korma = uniqueName("Korma");
  const beans = uniqueName("Beans on toast");
  await openApp(page, "/meals");
  await addMeal(page, korma, []);
  await addMeal(page, beans, []);
  const firstDay = await placeOnDay(page, korma, 0);
  await placeOnDay(page, beans, 0);
  const dayLabels = await page.locator("[data-position] h2").allTextContents();
  const heading = (dayIndex: number) =>
    dayCard(page, dayLabels[dayIndex] ?? "").getByRole("heading");
  for (const dayIndex of [1, 2, 3]) {
    expect(await mealNamesOn(page, dayLabels[dayIndex] ?? "")).toEqual([]);
  }

  const stopProbe = await startFrameProbe(page);
  const held = await press(
    page,
    await centre(plannedMealRow(page, beans, firstDay)),
    test.info().project.use.hasTouch ? 300 : 0,
  );
  // A mouse lifts on 8px down; a path that goes sideways first is a swipe.
  const lifted = await centre(plannedMealRow(page, beans, firstDay));
  await held.moveTo({ x: lifted.x, y: lifted.y + 12 });
  for (const dayIndex of [1, 2, 3, 2, 1]) {
    await held.moveTo(await centre(heading(dayIndex)));
  }
  await held.release();
  await page.waitForTimeout(600);
  const frames = await stopProbe();
  expect(jumpsIn(frames)).toEqual([]);
  await expect(plannedMealRow(page, beans, dayLabels[1] ?? "")).toBeVisible();
  await page.waitForTimeout(100);
  await removeFromDay(page, beans, dayLabels[1] ?? "");
  await removeFromDay(page, korma, firstDay);
});

test("the gap appears where it lands and does not slide from the stand-in", async ({
  page,
}) => {
  const names = [
    uniqueName("Chilli"),
    uniqueName("Tagine"),
    uniqueName("Gumbo"),
  ];
  await openApp(page, "/meals");
  for (const name of names) {
    await addMeal(page, name, []);
  }
  const day = await placeOnDay(page, names[0] ?? "", 0);
  await placeOnDay(page, names[1] ?? "", 0);
  await placeOnDay(page, names[2] ?? "", 0);
  const [first, second, third] = names.map((name) => name);
  const secondCentre = await centre(plannedMealRow(page, second ?? "", day));
  const thirdSlideKey = await plannedMealRow(page, third ?? "", day)
    .locator("xpath=ancestor::li[1]")
    .getAttribute("data-slide");

  const stopProbe = await startFrameProbe(page);
  const from = await centre(plannedMealRow(page, first ?? "", day));
  const held = await press(
    page,
    from,
    test.info().project.use.hasTouch ? 300 : 0,
  );
  // A mouse lifts on 12px straight down; a path that goes sideways first is a swipe.
  await held.moveTo({ x: from.x, y: from.y + 12 });
  await held.sweepTo({ x: secondCentre.x, y: secondCentre.y + 15 });
  await page.waitForTimeout(600);
  const frames = await stopProbe();

  const gapTops: number[] = [];
  const thirdTops: number[] = [];
  for (const frame of frames) {
    for (const [, slideKey, top] of frame.tops) {
      if (slideKey.startsWith("gap:")) {
        gapTops.push(top);
      } else if (slideKey === thirdSlideKey) {
        thirdTops.push(top);
      }
    }
  }
  expect(gapTops.length).toBeGreaterThan(10);
  for (const top of gapTops) {
    expect(Math.abs(top - (gapTops[0] ?? 0))).toBeLessThanOrEqual(1);
  }
  const thirdStart = thirdTops[0] ?? 0;
  const thirdEnd = thirdTops[thirdTops.length - 1] ?? 0;
  expect(thirdEnd - thirdStart).toBeGreaterThan(20);
  expect(
    thirdTops.some((top) => top > thirdStart + 3 && top < thirdEnd - 3),
  ).toBe(true);

  await held.release();
  await page.waitForTimeout(400);
  await removeFromDay(page, first ?? "", day);
  await removeFromDay(page, second ?? "", day);
  await removeFromDay(page, third ?? "", day);
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

test("a mouse swipe left on a day's meal reveals Remove without lifting it", async ({
  page,
}) => {
  test.skip(!!test.info().project.use.hasTouch, "a mouse swipe is a desktop's");
  const meal = uniqueName("Chilli");
  await openApp(page, "/meals");
  await addMeal(page, meal, []);
  const day = await placeOnDay(page, meal);
  const row = plannedMealRow(page, meal, day);
  const from = await centre(row);

  const held = await press(page, from, 0);
  await held.moveTo({ x: from.x - 60, y: from.y });
  await held.release();

  const remove = page.getByRole("button", {
    name: `Remove ${meal} from ${day}`,
    exact: true,
  });
  await expect(remove).toBeVisible();
  await expect
    .poll(async () => Math.round((await centre(row)).x - from.x))
    .toBeLessThan(-20);
  await expect(page.locator("[data-gap], [data-stand-in]")).toHaveCount(0);
  await remove.click();
  await expect(plannedMealRow(page, meal, day)).toHaveCount(0);
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
