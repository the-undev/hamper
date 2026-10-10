import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { hint, listBox } from "@/components/styles";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { dayDate } from "@/domain/display";
import { placeMeal } from "@/domain/plan";
import { usePlan, usePlannedMealsByPosition } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay } from "@/lib/dates";
import { counted } from "@/lib/utils";

/** "Add to a day", which opens a sheet of the plan's days and adds the meal at the end of the one tapped, and "On N days" once days within the length hold it. */
export function MealPlacement({ mealId }: { mealId: string }) {
  const plan = usePlan();
  const mealsByPosition = usePlannedMealsByPosition();
  const write = useWrite();
  const [choosing, setChoosing] = useState(false);
  if (plan === null) {
    return (
      <Button type="button" size="lg" className="w-full" disabled>
        Waiting for the server
      </Button>
    );
  }
  if (!plan || !mealsByPosition) {
    return null;
  }
  const positions = Array.from({ length: plan.lengthDays }, (_, at) => at);
  const placedDays = positions.filter((position) =>
    mealsByPosition
      .get(position)
      ?.some((plannedMeal) => plannedMeal.mealId === mealId),
  ).length;
  const addTo = (position: number): void => {
    setChoosing(false);
    void write((w) => placeMeal(w, position, mealId));
  };
  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="lg"
          className="flex-1"
          onClick={() => setChoosing(true)}
        >
          Add to a day
        </Button>
        {placedDays > 0 && (
          <p className={`${hint} m-0`}>On {counted(placedDays, "day")}</p>
        )}
      </div>
      <BottomSheet open={choosing} onClose={() => setChoosing(false)}>
        <SheetTitle className="text-lg font-bold">Add to a day</SheetTitle>
        <SheetDescription className="mb-3 text-xs text-muted">
          The meal goes after any already on the day.
        </SheetDescription>
        <ul className={`${listBox} m-0 list-none p-0`}>
          {positions.map((position) => {
            const mealCount = mealsByPosition.get(position)?.length ?? 0;
            return (
              <li
                key={position}
                className="border-line border-t first:border-t-0"
              >
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left hover:bg-soft"
                  onClick={() => addTo(position)}
                >
                  <b className="text-[15px] font-semibold">
                    {formatDay(dayDate(plan, position))}
                  </b>
                  <small className="text-xs text-muted">
                    {mealCount === 0
                      ? "nothing planned"
                      : counted(mealCount, "meal")}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
