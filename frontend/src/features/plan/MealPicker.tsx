import { TypeAhead } from "@/components/TypeAhead";
import { placeAdHoc, placeMeal } from "@/domain/plan";
import {
  lineNames,
  useItemsById,
  useLiveMeals,
  useMealLinesByMeal,
} from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";

/** How a day was filled: from a library meal, or as an ad-hoc day. */
export type Placement = "meal" | "adHoc";

/** The type-ahead over the library for a day, with "Use as it is" for a name matching no meal. */
export function MealPicker({
  position,
  onPlaced,
}: {
  position: number;
  onPlaced: (placement: Placement) => void;
}) {
  const write = useWrite();
  const meals = useLiveMeals();
  const linesByMeal = useMealLinesByMeal();
  const itemsById = useItemsById();

  const options = (meals ?? []).map((meal) => ({
    id: meal.id,
    name: meal.name,
    detail:
      lineNames(linesByMeal?.get(meal.id) ?? [], itemsById ?? new Map()) ||
      null,
  }));

  return (
    <TypeAhead
      label="Meal"
      placeholder="A meal, or anything: Takeaway, Leftovers…"
      options={options}
      listWhenEmpty
      onPick={async (option) => {
        const placed = await write(async (w) => {
          await placeMeal(w, position, option.id, nowIso());
          return true;
        });
        if (placed) {
          onPlaced("meal");
        }
      }}
      create={{
        label: (name) => `Use “${name}” as it is`,
        onCreate: async (name) => {
          const placed = await write(async (w) => {
            await placeAdHoc(w, position, name, nowIso());
            return true;
          });
          if (placed) {
            onPlaced("adHoc");
          }
        },
      }}
    />
  );
}
