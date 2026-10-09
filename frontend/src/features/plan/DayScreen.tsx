import { Link, useNavigate } from "@tanstack/react-router";
import { DoneButton } from "@/components/DoneButton";
import { EmptyState, WaitingForServer } from "@/components/EmptyState";
import { SavedField } from "@/components/SavedField";
import { ScreenFooter } from "@/components/ScreenFooter";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint, sectionLabel } from "@/components/styles";
import { Button } from "@/components/ui/button";
import { byPlanOrder, dayDate } from "@/domain/display";
import {
  clearDay,
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
import { DayLines } from "./DayLines";

/** Whether the day's lines differ from the meal's, item by item and count by count. */
function linesDiffer(
  dayLines: readonly PlannedMealLine[],
  mealLines: readonly MealLine[],
): boolean {
  const key = (lines: readonly { itemId: string; count: number }[]) =>
    lines
      .map((line) => `${line.itemId}:${line.count}`)
      .sort()
      .join();
  return key(dayLines) !== key(mealLines);
}

/** What the day's link says: the meal it came from and whether it changed, a deleted meal, or none. */
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

/** One day of the plan: its first planned meal, where it came from, and its lines for this day only; Part 2 turns this into the planned meal's screen. */
export function DayScreen({ position }: { position: number }) {
  const db = useDb();
  const write = useWrite();
  const navigate = useNavigate();
  const plan = usePlan();
  const itemsById = useItemsById();
  const dayState = useLive(async () => {
    const [day] = liveRows(
      await db.plannedMeals.where("position").equals(position).toArray(),
    ).sort(byPlanOrder);
    if (!day) {
      return { day: null, dayLines: [], linkedMeal: undefined, mealLines: [] };
    }
    const dayLines = liveRows(
      await db.plannedMealLines.where("plannedMealId").equals(day.id).toArray(),
    );
    const linkedMeal = day.mealId
      ? liveRow(await db.meals.get(day.mealId))
      : undefined;
    const mealLines = linkedMeal
      ? liveRows(
          await db.mealLines.where("mealId").equals(linkedMeal.id).toArray(),
        )
      : [];
    return { day, dayLines, linkedMeal, mealLines };
  }, [db, position]);

  const back = { to: "/plan", label: "Plan" } as const;
  if (plan === null) {
    return (
      <>
        <ScreenHeader title="Day" back={back} />
        <WaitingForServer />
      </>
    );
  }
  if (!plan || !dayState || !itemsById) {
    return <ScreenHeader title="Day" back={back} />;
  }

  const title = formatDay(dayDate(plan, position));
  const { day, dayLines, linkedMeal, mealLines } = dayState;
  if (!day) {
    return (
      <>
        <ScreenHeader title={title} back={back} />
        <EmptyState>Nothing planned for this day.</EmptyState>
        <Button asChild size="lg" className="flex-none">
          <Link
            to="/plan/pick/$position"
            params={{ position: String(position) }}
            search={{ from: "day" }}
          >
            Pick a meal
          </Link>
        </Button>
        <ScreenFooter>
          <DoneButton parent="/plan" />
        </ScreenFooter>
      </>
    );
  }

  const changed = linesDiffer(dayLines, mealLines);

  return (
    <>
      <ScreenHeader title={title} back={back} />
      <SavedField
        key={day.name}
        label="Name"
        value={day.name}
        title
        save={(w, name) => renamePlannedMeal(w, day.id, name)}
      />
      <p className={hint}>{originText(day.mealId, linkedMeal, changed)}</p>
      {linkedMeal && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-none"
          disabled={!changed}
          onClick={() =>
            void write((w) => resetPlannedMeal(w, day.id, nowIso()))
          }
        >
          Reset to the meal
        </Button>
      )}
      {!day.mealId && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-none"
          onClick={() => void write((w) => savePlannedMealAsMeal(w, day.id))}
        >
          Save as a meal
        </Button>
      )}
      <h3 className={sectionLabel}>
        Items{" "}
        <span className="font-medium normal-case tracking-normal">
          this day only
        </span>
      </h3>
      <DayLines
        plannedMealId={day.id}
        lines={dayLines}
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
            await write((w) => clearDay(w, position, nowIso()));
            await navigate({ to: "/plan" });
          }}
        >
          Clear day
        </Button>
        <DoneButton parent="/plan" />
      </ScreenFooter>
    </>
  );
}
