import {
  type ReactNode,
  type Ref,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  { value: "items", label: "Extras" },
] as const;

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

/** The plan, its days and its extras side by side on a track that slides between them by the tabs or a swipe; the last view is remembered. */
export function PlanScreen() {
  const plan = usePlan();
  const [view, setView] = useState<PlanView>(rememberedView);
  const frameRef = useRef<HTMLDivElement>(null);
  const mealsRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);

  // The frame is as tall as the view on show; the first size after a switch animates with the slide, and later ones apply at once.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const shown = (view === "meals" ? mealsRef : itemsRef).current;
    if (!frame || !shown) {
      return;
    }
    let switching = true;
    const observer = new ResizeObserver(([entry]) => {
      const height = entry?.borderBoxSize[0]?.blockSize;
      if (height === undefined) {
        return;
      }
      frame.style.transitionProperty = switching ? "" : "none";
      frame.style.height = `${height}px`;
      switching = false;
    });
    observer.observe(shown);
    return () => observer.disconnect();
  }, [view]);

  const choose = (chosenView: PlanView): void => {
    setView(chosenView);
    writeSetting(viewSetting, chosenView);
  };
  const { drag, handlers } = useViewSwipe(
    () => frameRef.current?.offsetWidth || window.innerWidth,
    (direction: SwipeDirection) => {
      if (direction) {
        choose(direction === "left" ? "items" : "meals");
      }
    },
  );

  return (
    <Tabs
      value={view}
      onValueChange={(value) => choose(value === "items" ? "items" : "meals")}
      className="flex-1 gap-3.5"
    >
      <ScreenHeader
        title="Plan"
        actions={plan ? <PlanRange plan={plan} /> : undefined}
      />
      <TabsList aria-label="Plan view">
        {views.map((planView) => (
          <TabsTrigger key={planView.value} value={planView.value}>
            {planView.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div
        className="-mx-4 flex flex-1 touch-pan-y touch-pinch-zoom flex-col"
        {...handlers}
      >
        <div
          ref={frameRef}
          data-plan-frame
          className="overflow-clip transition-[height] duration-200 motion-reduce:transition-none"
        >
          <div
            data-plan-track
            className={cn(
              "flex w-[200%] items-start",
              !drag &&
                "transition-transform duration-200 motion-reduce:transition-none",
            )}
            style={{ transform: trackTransform(view, drag) }}
          >
            <ViewPane ref={mealsRef} name="meals" active={view === "meals"}>
              <PlanMeals />
            </ViewPane>
            <ViewPane ref={itemsRef} name="items" active={view === "items"}>
              <PlanItems />
            </ViewPane>
          </div>
        </div>
      </div>
    </Tabs>
  );
}

/** One view on the track, the tab's panel; both stay mounted for the slide, and the inactive one is inert and hidden from screen readers. */
function ViewPane({
  ref,
  name,
  active,
  children,
}: {
  ref: Ref<HTMLDivElement>;
  name: PlanView;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <TabsContent
      ref={ref}
      value={name}
      forceMount
      data-plan-view={name}
      inert={!active}
      aria-hidden={active ? undefined : true}
      className="flex w-1/2 min-w-0 flex-none flex-col gap-3.5 px-4"
    >
      {children}
    </TabsContent>
  );
}
