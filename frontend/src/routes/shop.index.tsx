import { createFileRoute } from "@tanstack/react-router";
import { ScreenHeader } from "@/components/ScreenHeader";

export const Route = createFileRoute("/shop/")({
  component: () => <ScreenHeader title="Shop" />,
});
