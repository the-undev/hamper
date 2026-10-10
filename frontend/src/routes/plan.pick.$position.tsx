import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PickMealScreen } from "@/features/plan/PickMealScreen";

export const Route = createFileRoute("/plan/pick/$position")({
  component: PickRoute,
});

function PickRoute() {
  const { position } = Route.useParams();
  const dayPosition = Number(position);
  if (!Number.isInteger(dayPosition) || dayPosition < 0) {
    return (
      <>
        <ScreenHeader
          title="Pick a meal"
          back={{ to: "/plan", label: "Plan" }}
        />
        <EmptyState>There is no such day on the plan.</EmptyState>
      </>
    );
  }
  return <PickMealScreen key={dayPosition} position={dayPosition} />;
}
