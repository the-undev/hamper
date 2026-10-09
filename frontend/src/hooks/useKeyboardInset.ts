import { useEffect, useState } from "react";

/** How much of the layout viewport the phone's keyboard covers, and how tall the part left visible is. */
export interface KeyboardInset {
  /** The height in px the keyboard covers at the bottom of the layout viewport, 0 when there is none. */
  inset: number;
  /** The visual viewport's height in px, or null where the browser has no visualViewport. */
  visibleHeight: number | null;
}

/** Reads the inset from the visual viewport against the layout viewport. */
function readInset(): KeyboardInset {
  const viewport = window.visualViewport;
  if (!viewport) {
    return { inset: 0, visibleHeight: null };
  }
  const covered = window.innerHeight - viewport.height - viewport.offsetTop;
  return {
    inset: Math.max(0, Math.round(covered)),
    visibleHeight: Math.round(viewport.height),
  };
}

/** Follows the keyboard through the visual viewport, read once per frame; the fallback for a browser that ignores the viewport's request to shrink the page. */
export function useKeyboardInset(): KeyboardInset {
  const [keyboardInset, setKeyboardInset] = useState(readInset);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }
    let frame: number | null = null;
    const schedule = (): void => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => {
        frame = null;
        const next = readInset();
        setKeyboardInset((current) =>
          current.inset === next.inset &&
          current.visibleHeight === next.visibleHeight
            ? current
            : next,
        );
      });
    };
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    schedule();
    return () => {
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);

  return keyboardInset;
}
