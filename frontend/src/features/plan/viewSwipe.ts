import { type PointerEvent, useRef } from "react";

/** How far a finger travels sideways before a swipe switches the view. */
const switchDistance = 60;

/** Pointer handlers that report a sideways swipe across the element, ignoring ones that start on a swipeable row, a drag handle or a text box. */
export function useViewSwipe(onSwipe: (direction: "left" | "right") => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      const outside = !event.currentTarget.contains(target);
      const onControl = target.closest(
        "[data-swipe-row], [data-drag-handle], input",
      );
      start.current =
        outside || onControl ? null : { x: event.clientX, y: event.clientY };
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const swipeStart = start.current;
      start.current = null;
      if (!swipeStart) {
        return;
      }
      const movedX = event.clientX - swipeStart.x;
      const movedY = event.clientY - swipeStart.y;
      if (
        Math.abs(movedX) < switchDistance ||
        Math.abs(movedX) < 2 * Math.abs(movedY)
      ) {
        return;
      }
      onSwipe(movedX < 0 ? "left" : "right");
    },
  };
}
