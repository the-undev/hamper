import { createFileRoute } from "@tanstack/react-router";
import { PlannedMealScreen } from "@/features/plan/PlannedMealScreen";

export const Route = createFileRoute("/plan/meal/$plannedMealId")({
  component: PlannedMealRoute,
});

function PlannedMealRoute() {
  const { plannedMealId } = Route.useParams();
  return (
    <PlannedMealScreen key={plannedMealId} plannedMealId={plannedMealId} />
  );
}
