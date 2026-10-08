import { createFileRoute } from "@tanstack/react-router";
import { PlanScreen } from "@/features/plan/PlanScreen";

export const Route = createFileRoute("/plan/")({
  component: PlanScreen,
});
