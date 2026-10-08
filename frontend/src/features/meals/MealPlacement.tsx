import { primaryButton } from "@/components/styles";
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
      <button type="button" className={primaryButton} disabled>
        Waiting for the server
      </button>
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
      <button type="button" className={primaryButton} disabled>
        On the plan
      </button>
    );
  }
  const emptyPosition = positions.find((position) => !days.has(position));
  if (emptyPosition === undefined) {
    return (
      <button type="button" className={primaryButton} disabled>
        No empty day on the plan
      </button>
    );
  }
  return (
    <button
      type="button"
      className={primaryButton}
      onClick={() =>
        void write((w) => placeMeal(w, emptyPosition, mealId, nowIso()))
      }
    >
      Add to {formatDay(dayDate(plan, emptyPosition))}
    </button>
  );
}
