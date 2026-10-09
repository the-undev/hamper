import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DoneButton } from "@/components/DoneButton";
import { EmptyState } from "@/components/EmptyState";
import { ItemTypeAhead } from "@/components/ItemTypeAhead";
import { LineList, lineViews } from "@/components/LineList";
import { Picture } from "@/components/Picture";
import { SavedField } from "@/components/SavedField";
import { ScreenFooter } from "@/components/ScreenFooter";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint, sectionLabel } from "@/components/styles";
import { Button } from "@/components/ui/button";
import { addToMeal } from "@/domain/adds";
import { adjustLineCount } from "@/domain/counts";
import {
  deleteMeal,
  duplicateMeal,
  renameMeal,
  setMealLine,
} from "@/domain/meals";
import { CropUpload } from "@/features/images/CropUpload";
import { useItemsById } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatTimestampDay, nowIso } from "@/lib/dates";
import { liveRow, liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";
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
      <Picture name={meal.name} imageId={meal.imageId} size="hero" />
      <CropUpload
        table="meals"
        rowId={meal.id}
        hasImage={meal.imageId !== null}
      />
      <SavedField
        key={meal.name}
        label="Name"
        value={meal.name}
        title
        save={(w, name) => renameMeal(w, meal.id, name)}
      />
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
        addLine={(w, itemId) => addToMeal(w, mealId, itemId, nowIso())}
      />
      <LineList
        lines={lineViews(lines, itemsById)}
        empty="No items on this meal yet"
        onAdjust={(line, step) =>
          void write((w) => adjustLineCount(w, "mealLines", line.id, step))
        }
        onRemove={(line) =>
          void write((w) => setMealLine(w, mealId, line.itemId, 0, nowIso()))
        }
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
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
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1 text-danger"
          onClick={() => setConfirmingDelete(true)}
        >
          Delete
        </Button>
      </div>
      <ScreenFooter>
        <DoneButton parent="/meals" />
      </ScreenFooter>
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
