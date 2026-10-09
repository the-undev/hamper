import { createFileRoute } from "@tanstack/react-router";
import { Breakdown } from "@/features/shop/Breakdown";

export const Route = createFileRoute("/shop/breakdown")({
  component: Breakdown,
});
