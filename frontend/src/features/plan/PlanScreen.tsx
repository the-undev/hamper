import { useState } from "react";
import { Segmented } from "@/components/Segmented";
import { readSetting, writeSetting } from "@/lib/settings";
import { PlanItems } from "./PlanItems";
import { PlanMeals } from "./PlanMeals";
import { useViewSwipe } from "./viewSwipe";

type PlanView = "meals" | "items";

const viewSetting = "planView";

const views = [
  { value: "meals", label: "Meals" },
  { value: "items", label: "Items" },
] as const;

function rememberedView(): PlanView {
  return readSetting(viewSetting) === "items" ? "items" : "meals";
}

/** The plan, switched between its days and its wanted items by the segmented control or a swipe; the last view is remembered. */
export function PlanScreen() {
  const [view, setView] = useState<PlanView>(rememberedView);
  const choose = (chosenView: PlanView): void => {
    setView(chosenView);
    writeSetting(viewSetting, chosenView);
  };
  const swipeHandlers = useViewSwipe((direction) =>
    choose(direction === "left" ? "items" : "meals"),
  );
  return (
    <div className="flex flex-1 flex-col gap-3.5" {...swipeHandlers}>
      <Segmented
        label="Plan view"
        segments={views}
        value={view}
        onChange={choose}
      />
      {view === "meals" ? <PlanMeals /> : <PlanItems />}
    </div>
  );
}
