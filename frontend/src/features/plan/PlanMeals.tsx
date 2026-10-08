import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Counter } from "@/components/Counter";
import { WaitingForServer } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { secondaryButton } from "@/components/styles";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { dayDate } from "@/domain/display";
import {
  maxLengthDays,
  minLengthDays,
  setPlanLength,
  setPlanStart,
  startNewPlan,
} from "@/domain/plan";
import {
  useDayLinesByDay,
  useItemsById,
  usePlan,
  usePlannedDays,
} from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, nowIso } from "@/lib/dates";
import type { Plan } from "@/store/types";
import { DayList } from "./DayList";
import { MealPicker } from "./MealPicker";

/** The plan's days: the start date and length in the header, a slot per day, and Start new plan. */
export function PlanMeals() {
  const plan = usePlan();
  const days = usePlannedDays();
  const linesByDay = useDayLinesByDay();
  const itemsById = useItemsById();
  const write = useWrite();
  const navigate = useNavigate();
  const [pickingPosition, setPickingPosition] = useState<number | null>(null);
  const [confirmingNewPlan, setConfirmingNewPlan] = useState(false);

  if (plan === null) {
    return (
      <>
        <ScreenHeader title="Plan" />
        <WaitingForServer />
      </>
    );
  }
  if (!plan || !days || !linesByDay || !itemsById) {
    return <ScreenHeader title="Plan" />;
  }

  const nextStart = formatDay(dayDate(plan, plan.lengthDays));
  const pickingLabel =
    pickingPosition === null ? "" : formatDay(dayDate(plan, pickingPosition));

  return (
    <>
      <ScreenHeader title="Plan" actions={<PlanRange plan={plan} />} />
      <p className="m-0 text-[13px] text-muted">
        Starts <b className="text-foreground">{formatDay(plan.startDate)}</b>,
        ends{" "}
        <b className="text-foreground">
          {formatDay(dayDate(plan, plan.lengthDays - 1))}
        </b>
      </p>
      <DayList
        plan={plan}
        days={days}
        linesByDay={linesByDay}
        itemsById={itemsById}
        onPick={setPickingPosition}
      />
      <button
        type="button"
        className={secondaryButton}
        onClick={() => setConfirmingNewPlan(true)}
      >
        Start new plan from {nextStart}
      </button>
      <ConfirmDialog
        open={confirmingNewPlan}
        onOpenChange={setConfirmingNewPlan}
        title={`Start a new plan from ${nextStart}?`}
        description={`The start date moves on ${plan.lengthDays} days and Once items are cleared. Meals and Weekly items stay as they are.`}
        confirmLabel="Start new plan"
        onConfirm={() => void write((w) => startNewPlan(w, nowIso()))}
      />
      <Sheet
        open={pickingPosition !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPickingPosition(null);
          }
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="mx-auto max-h-[85dvh] max-w-[480px] overflow-y-auto rounded-t-2xl bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]"
        >
          <SheetTitle className="text-lg font-bold">
            Pick a meal for {pickingLabel}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted">
            A meal from the library, or any name for a day that is not one.
          </SheetDescription>
          {pickingPosition !== null && (
            <MealPicker
              position={pickingPosition}
              onPlaced={(placement) => {
                const placedPosition = pickingPosition;
                setPickingPosition(null);
                if (placement === "adHoc") {
                  void navigate({
                    to: "/plan/day/$position",
                    params: { position: String(placedPosition) },
                  });
                }
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** The start date, which opens the phone's date picker, and − N days +. */
function PlanRange({ plan }: { plan: Plan }) {
  const write = useWrite();
  return (
    <>
      <label className="relative flex h-11 items-center rounded-[10px] px-2 text-[13px] font-semibold text-accent hover:bg-soft">
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
        onChange={(lengthDays) =>
          void write((w) => setPlanLength(w, lengthDays))
        }
      />
    </>
  );
}
