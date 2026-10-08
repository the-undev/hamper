import { createFileRoute } from "@tanstack/react-router";
import { ItemEditor } from "@/features/more/ItemEditor";

export const Route = createFileRoute("/more/items/$itemId")({
  component: ItemRoute,
});

function ItemRoute() {
  const { itemId } = Route.useParams();
  return <ItemEditor key={itemId} itemId={itemId} />;
}
