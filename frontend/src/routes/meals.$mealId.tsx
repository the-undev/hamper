import { createFileRoute } from "@tanstack/react-router";
import { MealScreen } from "@/features/meals/MealScreen";

export const Route = createFileRoute("/meals/$mealId")({
  component: MealRoute,
});

function MealRoute() {
  const { mealId } = Route.useParams();
  return <MealScreen key={mealId} mealId={mealId} />;
}
