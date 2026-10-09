import { Button } from "@/components/ui/button";
import { dayDate } from "@/domain/display";
import { placeMeal } from "@/domain/plan";
import { usePlan, usePlannedMealsByPosition } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay } from "@/lib/dates";

/** "Add to <next empty day>", or "On the plan" once a day within the length holds the meal. */
export function MealPlacement({ mealId }: { mealId: string }) {
  const plan = usePlan();
  const days = usePlannedMealsByPosition();
  const write = useWrite();
  if (plan === null) {
    return (
      <Button type="button" size="lg" className="w-full" disabled>
        Waiting for the server
      </Button>
    );
  }
  if (!plan || !days) {
    return null;
  }
  const positions = Array.from({ length: plan.lengthDays }, (_, at) => at);
  // Part 2 replaces this with "Add to a day"; until then any planned meal of the meal within the length counts.
  const onPlan = positions.some((position) =>
    days.get(position)?.some((plannedMeal) => plannedMeal.mealId === mealId),
  );
  if (onPlan) {
    return (
      <Button type="button" size="lg" className="w-full" disabled>
        On the plan
      </Button>
    );
  }
  const emptyPosition = positions.find((position) => !days.has(position));
  if (emptyPosition === undefined) {
    return (
      <Button type="button" size="lg" className="w-full" disabled>
        No empty day on the plan
      </Button>
    );
  }
  return (
    <Button
      type="button"
      size="lg"
      className="w-full"
      onClick={() => void write((w) => placeMeal(w, emptyPosition, mealId))}
    >
      Add to {formatDay(dayDate(plan, emptyPosition))}
    </Button>
  );
}
