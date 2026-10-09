import { createFileRoute } from "@tanstack/react-router";
import { MealsScreen } from "@/features/meals/MealsScreen";

export const Route = createFileRoute("/meals/")({
  component: MealsScreen,
});
