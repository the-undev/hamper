import { createFileRoute } from "@tanstack/react-router";
import { HistoryScreen } from "@/features/more/HistoryScreen";

export const Route = createFileRoute("/more/history/")({
  component: HistoryScreen,
});
