import { type ClientRect, getClientRect } from "@dnd-kit/core";

/** How long a day card or a row takes to slide to its new place. */
export const slideMs = 200;

/** The id that marks a slide among an element's animations. */
const slideId = "plan-slide";

/** Where a card or row showed: its top on the screen, and the slide key of the card it was in. */
export interface ShownAt {
  top: number;
  card: string | null;
}

/** The day card an element sits in, not counting the element itself. */
function cardOf(element: HTMLElement): HTMLElement | null {
  return element.parentElement?.closest<HTMLElement>("[data-position]") ?? null;
}

/** How far an element is moved down by its transform, a slide part way through included. */
function translateYOf(element: Element): number {
  const matrix = /^matrix(3d)?\((.+)\)$/.exec(
    getComputedStyle(element).transform,
  );
  if (!matrix?.[2]) {
    return 0;
  }
  return Number(matrix[2].split(",")[matrix[1] ? 13 : 5]) || 0;
}

/** Where every card and row marked with a slide key shows now. */
export function shownNow(list: HTMLElement): Map<string, ShownAt> {
  const shown = new Map<string, ShownAt>();
  for (const element of list.querySelectorAll<HTMLElement>("[data-slide]")) {
    shown.set(element.dataset.slide ?? "", {
      top: element.getBoundingClientRect().top,
      card: cardOf(element)?.dataset.slide ?? null,
    });
  }
  return shown;
}

/** Slides every card and row from where it showed to where the layout now puts it; a row inside a card slides only by its move within the card, and a row that changed card appears in place. */
export function slideFrom(
  list: HTMLElement,
  before: ReadonlyMap<string, ShownAt>,
): void {
  const elements = [...list.querySelectorAll<HTMLElement>("[data-slide]")];
  for (const element of elements) {
    for (const animation of element.getAnimations()) {
      if (animation.id === slideId) {
        animation.cancel();
      }
    }
  }
  // Cards come before their rows in the document, so a row finds its card's slide already worked out.
  const shifts = new Map<HTMLElement, number>();
  for (const element of elements) {
    const was = before.get(element.dataset.slide ?? "");
    const card = cardOf(element);
    if (!was || was.card !== (card?.dataset.slide ?? null)) {
      continue;
    }
    const shift = was.top - element.getBoundingClientRect().top;
    shifts.set(element, shift);
    const ownShift = shift - (card ? (shifts.get(card) ?? 0) : 0);
    if (Math.abs(ownShift) < 0.5) {
      continue;
    }
    element.animate(
      [{ transform: `translateY(${ownShift}px)` }, { transform: "none" }],
      { duration: slideMs, easing: "ease", id: slideId },
    );
  }
}

/** An element's box where the layout puts it, without its own slide or the slide of the card it is in, so a drag meets rows where they are going. */
export function settledRect(element: HTMLElement): ClientRect {
  const rect = getClientRect(element, { ignoreTransform: true });
  const card = cardOf(element);
  const cardShift = card ? translateYOf(card) : 0;
  return {
    ...rect,
    top: rect.top - cardShift,
    bottom: rect.bottom - cardShift,
  };
}
