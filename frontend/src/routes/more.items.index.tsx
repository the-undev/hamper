import { createFileRoute } from "@tanstack/react-router";
import { ItemsScreen } from "@/features/more/ItemsScreen";

export const Route = createFileRoute("/more/items/")({
  component: ItemsScreen,
});
