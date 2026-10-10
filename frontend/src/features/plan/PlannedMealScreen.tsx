import { useNavigate } from "@tanstack/react-router";
import { DoneButton } from "@/components/DoneButton";
import { EmptyState, WaitingForServer } from "@/components/EmptyState";
import { SavedField } from "@/components/SavedField";
import { ScreenFooter } from "@/components/ScreenFooter";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint, sectionLabel } from "@/components/styles";
import { Button } from "@/components/ui/button";
import { dayDate } from "@/domain/display";
import {
  removePlannedMeal,
  renamePlannedMeal,
  resetPlannedMeal,
  savePlannedMealAsMeal,
} from "@/domain/plan";
import { useItemsById, usePlan } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, nowIso } from "@/lib/dates";
import { liveRow, liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";
import type { Meal, MealLine, PlannedMealLine } from "@/store/types";
import { PlannedMealLines } from "./PlannedMealLines";

/** Whether the planned meal's lines differ from the meal's, item by item and count by count. */
function linesDiffer(
  plannedMealLines: readonly PlannedMealLine[],
  mealLines: readonly MealLine[],
): boolean {
  const key = (lines: readonly { itemId: string; count: number }[]) =>
    lines
      .map((line) => `${line.itemId}:${line.count}`)
      .sort()
      .join();
  return key(plannedMealLines) !== key(mealLines);
}

/** What the planned meal's link says: the meal it came from and whether it changed, a deleted meal, or none. */
function originText(
  mealId: string | null,
  linkedMeal: Meal | undefined,
  changed: boolean,
): string {
  if (!mealId) {
    return "Not a meal in the library";
  }
  if (!linkedMeal) {
    return "The meal it came from has been deleted";
  }
  return changed
    ? `From the meal ${linkedMeal.name}, changed for this day`
    : `From the meal ${linkedMeal.name}`;
}

const back = { to: "/plan", label: "Plan" } as const;

/** One planned meal: its day, its name, where it came from, and its lines for it only. */
export function PlannedMealScreen({
  plannedMealId,
}: {
  plannedMealId: string;
}) {
  const db = useDb();
  const write = useWrite();
  const navigate = useNavigate();
  const plan = usePlan();
  const itemsById = useItemsById();
  const plannedMealState = useLive(async () => {
    const plannedMeal = liveRow(await db.plannedMeals.get(plannedMealId));
    if (!plannedMeal) {
      return null;
    }
    const plannedMealLines = liveRows(
      await db.plannedMealLines
        .where("plannedMealId")
        .equals(plannedMealId)
        .toArray(),
    );
    const linkedMeal = plannedMeal.mealId
      ? liveRow(await db.meals.get(plannedMeal.mealId))
      : undefined;
    const mealLines = linkedMeal
      ? liveRows(
          await db.mealLines.where("mealId").equals(linkedMeal.id).toArray(),
        )
      : [];
    return { plannedMeal, plannedMealLines, linkedMeal, mealLines };
  }, [db, plannedMealId]);

  if (plan === null) {
    return (
      <>
        <ScreenHeader title="Planned meal" back={back} />
        <WaitingForServer />
      </>
    );
  }
  if (plannedMealState === null) {
    return (
      <>
        <ScreenHeader title="Planned meal" back={back} />
        <EmptyState>This meal is no longer on the plan.</EmptyState>
      </>
    );
  }
  if (!plan || !plannedMealState || !itemsById) {
    return <ScreenHeader title="Planned meal" back={back} />;
  }

  const { plannedMeal, plannedMealLines, linkedMeal, mealLines } =
    plannedMealState;
  const changed = linesDiffer(plannedMealLines, mealLines);

  return (
    <>
      <ScreenHeader
        title={formatDay(dayDate(plan, plannedMeal.position))}
        back={back}
      />
      <SavedField
        key={plannedMeal.name}
        label="Name"
        value={plannedMeal.name}
        title
        save={(w, name) => renamePlannedMeal(w, plannedMeal.id, name)}
      />
      <p className={hint}>
        {originText(plannedMeal.mealId, linkedMeal, changed)}
      </p>
      {linkedMeal && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-none"
          disabled={!changed}
          onClick={() =>
            void write((w) => resetPlannedMeal(w, plannedMeal.id, nowIso()))
          }
        >
          Reset to the meal
        </Button>
      )}
      {!plannedMeal.mealId && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-none"
          onClick={() =>
            void write((w) => savePlannedMealAsMeal(w, plannedMeal.id))
          }
        >
          Save as a meal
        </Button>
      )}
      <h3 className={sectionLabel}>
        Items{" "}
        <span className="font-medium normal-case tracking-normal">
          this day's meal only
        </span>
      </h3>
      <PlannedMealLines
        plannedMealId={plannedMeal.id}
        lines={plannedMealLines}
        itemsById={itemsById}
        typeAheadLabel="Add an item for this day"
      />
      <ScreenFooter>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1 text-danger"
          onClick={async () => {
            await write((w) => removePlannedMeal(w, plannedMeal.id, nowIso()));
            await navigate({ to: "/plan" });
          }}
        >
          Remove from day
        </Button>
        <DoneButton parent="/plan" />
      </ScreenFooter>
    </>
  );
}
