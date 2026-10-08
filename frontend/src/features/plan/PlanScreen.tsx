import { type ReactNode, useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Segmented } from "@/components/Segmented";
import { usePlan } from "@/hooks/data";
import { readSetting, writeSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { PlanItems } from "./PlanItems";
import { PlanMeals, PlanRange } from "./PlanMeals";
import { type SwipeDirection, useViewSwipe, type ViewDrag } from "./viewSwipe";

type PlanView = "meals" | "items";

const viewSetting = "planView";

const views = [
  { value: "meals", label: "Meals" },
  { value: "items", label: "Items" },
] as const;

/** How long the track takes to settle, matching its duration-200 transition. */
const settleMs = 200;

function rememberedView(): PlanView {
  return readSetting(viewSetting) === "items" ? "items" : "meals";
}

/** The track's transform: following a drag, clamped to the two views, or settled on one; Meals settled has none, so the day list's fixed drag overlay is not caught by it. */
function trackTransform(
  view: PlanView,
  drag: ViewDrag | null,
): string | undefined {
  if (drag) {
    const base = view === "items" ? -drag.width : 0;
    const position = Math.min(0, Math.max(-drag.width, base + drag.movedX));
    return `translateX(${position}px)`;
  }
  return view === "items" ? "translateX(-50%)" : undefined;
}

/** The plan, its days and its wanted items side by side on a track that slides between them by the segmented control or a swipe; the last view is remembered. */
export function PlanScreen() {
  const plan = usePlan();
  const [view, setView] = useState<PlanView>(rememberedView);
  const [settling, setSettling] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const settle = (): void => {
    setSettling(true);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettling(false), settleMs);
  };
  const choose = (chosenView: PlanView): void => {
    setView(chosenView);
    writeSetting(viewSetting, chosenView);
    settle();
  };
  const { drag, handlers } = useViewSwipe(
    () => frameRef.current?.offsetWidth || window.innerWidth,
    (direction: SwipeDirection) => {
      if (!direction) {
        settle();
        return;
      }
      choose(direction === "left" ? "items" : "meals");
    },
  );
  const moving = drag !== null || settling;

  return (
    <div className="flex flex-1 flex-col gap-3.5">
      <ScreenHeader
        title="Plan"
        actions={
          view === "meals" && plan ? <PlanRange plan={plan} /> : undefined
        }
      />
      <Segmented
        label="Plan view"
        segments={views}
        value={view}
        onChange={choose}
      />
      <div
        ref={frameRef}
        className="-mx-4 flex flex-1 touch-pan-y touch-pinch-zoom overflow-hidden"
        {...handlers}
      >
        <div
          data-plan-track
          className={cn(
            "flex w-[200%] flex-none items-start",
            !drag &&
              "transition-transform duration-200 motion-reduce:transition-none",
          )}
          style={{ transform: trackTransform(view, drag) }}
        >
          <ViewPane name="meals" active={view === "meals"} moving={moving}>
            <PlanMeals />
          </ViewPane>
          <ViewPane name="items" active={view === "items"} moving={moving}>
            <PlanItems />
          </ViewPane>
        </div>
      </div>
    </div>
  );
}

/** One view on the track; the inactive one is inert and hidden from screen readers, and collapses once the track is still so the page is as tall as the view on show. */
function ViewPane({
  name,
  active,
  moving,
  children,
}: {
  name: PlanView;
  active: boolean;
  moving: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-plan-view={name}
      inert={!active}
      aria-hidden={active ? undefined : true}
      className={cn(
        "flex w-1/2 min-w-0 flex-none flex-col gap-3.5 px-4",
        !active && !moving && "h-0 overflow-hidden",
      )}
    >
      {children}
    </div>
  );
}
