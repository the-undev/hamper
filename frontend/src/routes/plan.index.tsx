import { createFileRoute } from "@tanstack/react-router";
import { ScreenHeader } from "@/components/ScreenHeader";

export const Route = createFileRoute("/plan/")({
  component: () => <ScreenHeader title="Plan" />,
});
