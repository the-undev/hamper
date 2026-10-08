import { useNavigate } from "@tanstack/react-router";
import { EmptyState, WaitingForServer } from "@/components/EmptyState";
import { SavedField } from "@/components/SavedField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint, secondaryButton, sectionLabel } from "@/components/styles";
import { dayDate } from "@/domain/display";
import { clearDay, renameDay, resetDay, saveDayAsMeal } from "@/domain/plan";
import { useItemsById, usePlan } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, nowIso } from "@/lib/dates";
import { dayIdFor } from "@/store/ids";
import { liveRow, liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";
import type { DayLine, Meal, MealLine } from "@/store/types";
import { DayLines } from "./DayLines";
import { MealPicker } from "./MealPicker";

/** Whether the day's lines differ from the meal's, item by item and count by count. */
function linesDiffer(
  dayLines: readonly DayLine[],
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

/** One day of the plan: its meal, where it came from, and its lines for this day only. */
export function DayScreen({ position }: { position: number }) {
  const db = useDb();
  const write = useWrite();
  const navigate = useNavigate();
  const plan = usePlan();
  const itemsById = useItemsById();
  const dayId = dayIdFor(position);
  const dayState = useLive(async () => {
    const day = liveRow(await db.days.get(dayId));
    if (!day) {
      return { day: null, dayLines: [], linkedMeal: undefined, mealLines: [] };
    }
    const dayLines = liveRows(
      await db.dayLines.where("dayId").equals(dayId).toArray(),
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
  }, [db, dayId]);

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
        <EmptyState>Nothing planned for this day. Pick a meal.</EmptyState>
        <MealPicker position={position} onPlaced={() => {}} />
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
        save={(w, name) => renameDay(w, position, name)}
      />
      <p className={hint}>{originText(day.mealId, linkedMeal, changed)}</p>
      <div className="flex gap-2">
        {linkedMeal && (
          <button
            type="button"
            className={secondaryButton}
            disabled={!changed}
            onClick={() => void write((w) => resetDay(w, position, nowIso()))}
          >
            Reset to the meal
          </button>
        )}
        {!day.mealId && (
          <button
            type="button"
            className={secondaryButton}
            onClick={() => void write((w) => saveDayAsMeal(w, position))}
          >
            Save as a meal
          </button>
        )}
        <button
          type="button"
          className={`${secondaryButton} text-danger`}
          onClick={async () => {
            await write((w) => clearDay(w, position, nowIso()));
            await navigate({ to: "/plan" });
          }}
        >
          Clear day
        </button>
      </div>
      <h3 className={sectionLabel}>
        Items{" "}
        <span className="font-medium normal-case tracking-normal">
          this day only
        </span>
      </h3>
      <DayLines
        position={position}
        lines={dayLines}
        itemsById={itemsById}
        typeAheadLabel="Add an item for this day"
      />
    </>
  );
}
