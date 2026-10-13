import { useState } from "react";
import { readSetting, writeSetting } from "@/lib/settings";
import { type MealsView, mealsViewSetting, parseMealsView } from "./mealsView";

/** The Meals screen's view as this phone last chose it, and a setter that keeps the new choice. */
export function useMealsView(): [MealsView, (view: MealsView) => void] {
  const [view, setView] = useState(() =>
    parseMealsView(readSetting(mealsViewSetting)),
  );
  const chooseView = (chosenView: MealsView): void => {
    setView(chosenView);
    writeSetting(mealsViewSetting, chosenView);
  };
  return [view, chooseView];
}
