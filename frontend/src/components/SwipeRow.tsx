import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/** A button revealed by swiping a row left. */
export interface SwipeAction {
  label: string;
  onAction: () => void;
  tone: "danger" | "accent";
}

/** How far a finger moves before a press becomes a swipe. */
const swipeThreshold = 8;

/** Where a swipe started, and whether it has become one. */
interface SwipeStart {
  x: number;
  y: number;
  swiping: boolean;
}

/** A row that slides left to reveal action buttons; the buttons are always in the page, so a keyboard reaches them and opens the row. */
export function SwipeRow({
  subject,
  actions,
  children,
  className,
  rounded,
}: {
  /** What the row is, for the action buttons' names: "Remove <subject>". */
  subject: string;
  actions: readonly SwipeAction[];
  children: ReactNode;
  className?: string;
  /** A rounding class for the row's shape; the wrapper takes it too, so the action strip is clipped to it. */
  rounded?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const start = useRef<SwipeStart | null>(null);
  const swiped = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const actionsWidth = (): number => actionsRef.current?.offsetWidth || 96;

  const setOpenState = (isOpen: boolean): void => {
    setOpen(isOpen);
    setOffset(isOpen ? -actionsWidth() : 0);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOnOutsidePress = (event: globalThis.PointerEvent): void => {
      if (!rowRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setOffset(0);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    if (target.closest('input, [role="checkbox"], [data-drag-handle]')) {
      return;
    }
    start.current = { x: event.clientX, y: event.clientY, swiping: false };
    swiped.current = false;
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const swipe = start.current;
    if (!swipe) {
      return;
    }
    const movedX = event.clientX - swipe.x;
    const movedY = event.clientY - swipe.y;
    if (!swipe.swiping) {
      if (Math.abs(movedY) > Math.abs(movedX)) {
        start.current = null;
        return;
      }
      if (Math.abs(movedX) < swipeThreshold) {
        return;
      }
      swipe.swiping = true;
      swiped.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    const width = actionsWidth();
    const base = open ? -width : 0;
    setOffset(Math.min(0, Math.max(-(width + 24), base + movedX)));
  };

  const onPointerEnd = (): void => {
    const swipe = start.current;
    start.current = null;
    if (!swipe?.swiping) {
      return;
    }
    setOpenState(offset < -actionsWidth() * 0.6);
  };

  return (
    <div
      ref={rowRef}
      data-swipe-row
      className={cn("relative overflow-hidden", rounded)}
    >
      <div
        className={cn(
          "relative z-[1] touch-pan-y select-none bg-surface",
          start.current?.swiping ? "" : "transition-transform duration-150",
          rounded,
          className,
        )}
        style={
          offset === 0 ? undefined : { transform: `translateX(${offset}px)` }
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(event) => {
          if (swiped.current) {
            event.preventDefault();
            event.stopPropagation();
            swiped.current = false;
          }
        }}
      >
        {children}
      </div>
      <div ref={actionsRef} className="absolute inset-y-0 right-0 flex">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            aria-label={`${action.label} ${subject}`}
            onFocus={() => setOpenState(true)}
            onBlur={(event) => {
              if (!actionsRef.current?.contains(event.relatedTarget as Node)) {
                setOpenState(false);
              }
            }}
            onClick={() => {
              setOpenState(false);
              action.onAction();
            }}
            className={cn(
              "min-w-20 px-3.5 text-[13px] font-semibold",
              action.tone === "danger"
                ? "bg-danger text-white"
                : "bg-accent text-accent-foreground",
            )}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
