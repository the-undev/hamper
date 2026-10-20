import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Counter } from "@/components/Counter";
import { WaitingForServer } from "@/components/EmptyState";
import { lineViews } from "@/components/LineList";
import { dayDate } from "@/domain/display";
import {
  adjustPlanLength,
  maxLengthDays,
  minLengthDays,
  setPlanStart,
  startNewPlan,
} from "@/domain/plan";
import {
  useItemsById,
  useMealsById,
  usePlan,
  usePlannedMealLinesByPlannedMeal,
  usePlannedMealsByPosition,
} from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, localIsoDate, nowIso } from "@/lib/dates";
import { liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";
import type { Plan } from "@/store/types";
import { DayList } from "./DayList";

/** The plan's days: when they start and end, a card per day with its planned meals, and Move plan on. */
export function PlanMeals() {
  const plan = usePlan();
  const mealsByPosition = usePlannedMealsByPosition();
  const linesByPlannedMeal = usePlannedMealLinesByPlannedMeal();
  const itemsById = useItemsById();
  const mealsById = useMealsById();
  const write = useWrite();
  const db = useDb();
  const wantedLines = useLive(
    async () => liveRows(await db.wantedLines.toArray()),
    [db],
  );
  const [confirmingNewPlan, setConfirmingNewPlan] = useState(false);

  if (plan === null) {
    return <WaitingForServer />;
  }
  if (
    !plan ||
    !wantedLines ||
    !mealsByPosition ||
    !linesByPlannedMeal ||
    !itemsById ||
    !mealsById
  ) {
    return null;
  }

  const nextStart = formatDay(dayDate(plan, plan.lengthDays));
  const endDate = dayDate(plan, plan.lengthDays - 1);
  const today = localIsoDate(new Date());
  const ending = today >= dayDate(plan, plan.lengthDays - 2);
  const onceNames = lineViews(
    wantedLines.filter((line) => !line.weekly),
    itemsById,
  ).map((line) => line.name);

  return (
    <>
      {ending && (
        <div className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-soft p-3">
          <p className="m-0 text-sm font-semibold text-accent">
            This plan {today > endDate ? "ended" : "ends"} {formatDay(endDate)}
          </p>
          <button
            type="button"
            className="min-h-11 flex-none rounded-[10px] border border-line bg-surface px-3 text-sm font-bold text-accent"
            onClick={() => setConfirmingNewPlan(true)}
          >
            Move plan on to {nextStart}
          </button>
        </div>
      )}
      <p className="m-0 text-[13px] text-muted">
        Starts <b className="text-foreground">{formatDay(plan.startDate)}</b>,
        ends <b className="text-foreground">{formatDay(endDate)}</b>.{" "}
        {changingDatesKeepsMeals}
      </p>
      <div className="flex flex-col gap-2">
        <DayList
          plan={plan}
          mealsByPosition={mealsByPosition}
          linesByPlannedMeal={linesByPlannedMeal}
          itemsById={itemsById}
          mealsById={mealsById}
        />
        <button
          type="button"
          className="min-h-[62px] w-full rounded-[14px] border border-line bg-surface px-4 text-[15px] font-bold text-accent"
          onClick={() => setConfirmingNewPlan(true)}
        >
          Move plan on to {nextStart}
        </button>
      </div>
      <ConfirmDialog
        open={confirmingNewPlan}
        onOpenChange={setConfirmingNewPlan}
        title={`Move the plan on to ${nextStart}?`}
        description={
          <>
            <span className="block">
              Days become {nextStart} to{" "}
              {formatDay(dayDate(plan, 2 * plan.lengthDays - 1))}. Meals stay on
              their days.
            </span>
            <span className="block">Weekly items stay.</span>
            <span className="block">{onceSentence(onceNames)}</span>
          </>
        }
        confirmLabel="Move plan on"
        onConfirm={() => void write((w) => startNewPlan(w, nowIso()))}
      />
    </>
  );
}

const changingDatesKeepsMeals =
  "Changing the dates keeps every meal on its day.";

/** Says which Once items moving the plan on clears. */
function onceSentence(names: readonly string[]): string {
  if (names.length === 0) {
    return "No Once items to clear.";
  }
  const noun = names.length === 1 ? "Once item is" : "Once items are";
  return `${names.length} ${noun} cleared: ${names.join(", ")}.`;
}

/** The start date, which opens the phone's date picker, and − N days +, for the header. */
export function PlanRange({ plan }: { plan: Plan }) {
  const write = useWrite();
  return (
    <>
      <label
        title={changingDatesKeepsMeals}
        className="relative flex h-11 items-center rounded-[10px] px-2 text-[13px] font-semibold text-accent hover:bg-soft"
      >
        {formatDay(plan.startDate)}
        <input
          type="date"
          aria-label="Start date"
          value={plan.startDate}
          required
          onClick={(event) => {
            try {
              event.currentTarget.showPicker();
            } catch {
              // Browsers without showPicker open the picker on the tap itself.
            }
          }}
          onChange={(event) => {
            const startDate = event.target.value;
            if (startDate) {
              void write((w) => setPlanStart(w, startDate));
            }
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <Counter
        count={plan.lengthDays}
        subject="day"
        min={minLengthDays}
        max={maxLengthDays}
        format={(count) => `${count} days`}
        onAdjust={(step) => void write((w) => adjustPlanLength(w, step))}
      />
    </>
  );
}
