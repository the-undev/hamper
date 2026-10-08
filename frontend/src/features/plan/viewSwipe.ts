import { type MouseEvent, type PointerEvent, useRef, useState } from "react";

/** How far a pointer moves before the swipe's axis is decided, as on a swipeable row. */
const axisThreshold = 8;

/** A release at this speed or faster, in px per ms, switches the view however short the swipe. */
const flickSpeed = 0.5;

/** Where a press started, when, and whether it has become a sideways swipe. */
interface SwipeStart {
  x: number;
  y: number;
  time: number;
  sideways: boolean;
}

/** How far a sideways swipe has moved, and the width of the views it moves. */
export interface ViewDrag {
  movedX: number;
  width: number;
}

/** Which way a released swipe switches the view, or null to settle back. */
export type SwipeDirection = "left" | "right" | null;

/** Pointer handlers for a sideways swipe across the views, ignoring presses on a swipeable row, a drag handle or a text box; the drag follows the pointer and the release passes a third of the width, or is fast, to switch. */
export function useViewSwipe(
  width: () => number,
  onRelease: (direction: SwipeDirection) => void,
) {
  const start = useRef<SwipeStart | null>(null);
  const swiped = useRef(false);
  const [drag, setDrag] = useState<ViewDrag | null>(null);

  const end = (event: PointerEvent<HTMLElement>, cancelled: boolean): void => {
    const swipe = start.current;
    start.current = null;
    if (!swipe?.sideways) {
      return;
    }
    setDrag(null);
    const movedX = event.clientX - swipe.x;
    const elapsed = Math.max(1, event.timeStamp - swipe.time);
    const passed =
      Math.abs(movedX) > width() / 3 ||
      Math.abs(movedX) / elapsed >= flickSpeed;
    if (cancelled || !passed) {
      onRelease(null);
      return;
    }
    onRelease(movedX < 0 ? "left" : "right");
  };

  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      const onControl = target.closest(
        "[data-swipe-row], [data-drag-handle], input",
      );
      swiped.current = false;
      start.current = onControl
        ? null
        : {
            x: event.clientX,
            y: event.clientY,
            time: event.timeStamp,
            sideways: false,
          };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const swipe = start.current;
      if (!swipe) {
        return;
      }
      const movedX = event.clientX - swipe.x;
      const movedY = event.clientY - swipe.y;
      if (!swipe.sideways) {
        if (Math.max(Math.abs(movedX), Math.abs(movedY)) < axisThreshold) {
          return;
        }
        if (Math.abs(movedY) >= Math.abs(movedX)) {
          start.current = null;
          return;
        }
        swipe.sideways = true;
        swiped.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      setDrag({ movedX, width: width() });
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => end(event, false),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => end(event, true),
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (swiped.current) {
        event.preventDefault();
        event.stopPropagation();
        swiped.current = false;
      }
    },
  };
  return { drag, handlers };
}
