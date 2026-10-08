import { createFileRoute } from "@tanstack/react-router";
import { ArchivedShopScreen } from "@/features/more/ArchivedShopScreen";

export const Route = createFileRoute("/more/history/$archivedId")({
  component: ArchivedShopRoute,
});

function ArchivedShopRoute() {
  const { archivedId } = Route.useParams();
  return <ArchivedShopScreen key={archivedId} archivedId={archivedId} />;
}
