import { Button } from "@/components/ui/button";
import { dayDate } from "@/domain/display";
import { placeMeal } from "@/domain/plan";
import { usePlan, usePlannedDays } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, nowIso } from "@/lib/dates";

/** "Add to <next empty day>", or "On the plan" once a day within the length holds the meal. */
export function MealPlacement({ mealId }: { mealId: string }) {
  const plan = usePlan();
  const days = usePlannedDays();
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
  const onPlan = positions.some(
    (position) => days.get(position)?.mealId === mealId,
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
      onClick={() =>
        void write((w) => placeMeal(w, emptyPosition, mealId, nowIso()))
      }
    >
      Add to {formatDay(dayDate(plan, emptyPosition))}
    </Button>
  );
}
