import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { DayScreen } from "@/features/plan/DayScreen";

export const Route = createFileRoute("/plan/day/$position")({
  component: DayRoute,
});

function DayRoute() {
  const { position } = Route.useParams();
  const dayPosition = Number(position);
  if (!Number.isInteger(dayPosition) || dayPosition < 0) {
    return (
      <>
        <ScreenHeader title="Day" back={{ to: "/plan", label: "Plan" }} />
        <EmptyState>There is no such day on the plan.</EmptyState>
      </>
    );
  }
  return <DayScreen key={dayPosition} position={dayPosition} />;
}
