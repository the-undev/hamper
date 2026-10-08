import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { ItemTypeAhead } from "@/components/ItemTypeAhead";
import { LineList, lineViews } from "@/components/LineList";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint, secondaryButton, sectionLabel } from "@/components/styles";
import { Thumb } from "@/components/Thumb";
import { liveWhere } from "@/domain/checks";
import {
  deleteMeal,
  duplicateMeal,
  renameMeal,
  setMealLine,
} from "@/domain/meals";
import { useItemsById } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatTimestampDay, nowIso } from "@/lib/dates";
import { liveRow, liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";
import type { Meal } from "@/store/types";
import { useLastShopped } from "./lastShopped";
import { MealPlacement } from "./MealPlacement";

const back = { to: "/meals", label: "Meals" } as const;

/** One library meal: its picture, name, when it was last shopped for, its place on the plan, and its lines. */
export function MealScreen({ mealId }: { mealId: string }) {
  const db = useDb();
  const write = useWrite();
  const navigate = useNavigate();
  const itemsById = useItemsById();
  const lastShopped = useLastShopped(mealId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const mealState = useLive(async () => {
    const meal = liveRow(await db.meals.get(mealId));
    if (!meal) {
      return null;
    }
    const lines = liveRows(
      await db.mealLines.where("mealId").equals(mealId).toArray(),
    );
    return { meal, lines };
  }, [db, mealId]);

  if (mealState === null) {
    return (
      <>
        <ScreenHeader title="Meal" back={back} />
        <EmptyState>This meal has been deleted.</EmptyState>
      </>
    );
  }
  if (!mealState || !itemsById) {
    return <ScreenHeader title="Meal" back={back} />;
  }
  const { meal, lines } = mealState;

  return (
    <>
      <ScreenHeader title="Meal" back={back} />
      <div className="relative">
        <Thumb name={meal.name} size="hero" />
        <button
          type="button"
          disabled
          className="absolute right-2.5 bottom-2.5 rounded-full bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-70"
        >
          Change photo
        </button>
      </div>
      <MealName key={meal.name} meal={meal} />
      {lastShopped !== undefined && (
        <p className={hint}>
          {lastShopped === null
            ? "Not shopped for yet"
            : `Last shopped ${formatTimestampDay(lastShopped)}`}
        </p>
      )}
      <MealPlacement mealId={meal.id} />
      <h2 className={sectionLabel}>
        Items{" "}
        <span className="font-medium normal-case tracking-normal">
          a count is one meal's worth
        </span>
      </h2>
      <ItemTypeAhead
        label="Add an item to this meal"
        placeholder="Add an item to this meal…"
        addLine={async (w, itemId) => {
          const currentLines = await liveWhere(
            w,
            "mealLines",
            "mealId",
            mealId,
          );
          const currentCount =
            currentLines.find((line) => line.itemId === itemId)?.count ?? 0;
          await setMealLine(w, mealId, itemId, currentCount + 1, nowIso());
        }}
      />
      <LineList
        lines={lineViews(lines, itemsById)}
        empty="No items on this meal yet"
        onCount={(line, count) =>
          void write((w) =>
            setMealLine(w, mealId, line.itemId, count, nowIso()),
          )
        }
        onRemove={(line) =>
          void write((w) => setMealLine(w, mealId, line.itemId, 0, nowIso()))
        }
      />
      <div className="flex gap-2">
        <button
          type="button"
          className={secondaryButton}
          onClick={async () => {
            const copiedMeal = await write((w) => duplicateMeal(w, mealId));
            if (copiedMeal) {
              await navigate({
                to: "/meals/$mealId",
                params: { mealId: copiedMeal.id },
              });
            }
          }}
        >
          Duplicate
        </button>
        <button
          type="button"
          className={`${secondaryButton} text-danger`}
          onClick={() => setConfirmingDelete(true)}
        >
          Delete
        </button>
      </div>
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${meal.name}?`}
        description="The meal leaves the library. Days already planned from it keep their copy."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          await write((w) => deleteMeal(w, mealId, nowIso()));
          await navigate({ to: "/meals" });
        }}
      />
    </>
  );
}

/** The meal's name as a text box, saved when it loses focus or on Enter. */
function MealName({ meal }: { meal: Meal }) {
  const write = useWrite();
  const [name, setName] = useState(meal.name);
  const save = async (): Promise<void> => {
    if (name.trim() === meal.name) {
      return;
    }
    const renamed = await write(async (w) => {
      await renameMeal(w, meal.id, name);
      return true;
    });
    if (!renamed) {
      setName(meal.name);
    }
  };
  return (
    <input
      aria-label="Name"
      value={name}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => void save()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className="min-h-11 w-full rounded-[10px] border border-transparent bg-transparent px-1 text-[22px] font-bold hover:border-line focus:border-line"
    />
  );
}
