import { createFileRoute } from "@tanstack/react-router";
import { ShopScreen } from "@/features/shop/ShopScreen";

export const Route = createFileRoute("/shop/$shopId")({
  component: ShopRoute,
});

function ShopRoute() {
  const { shopId } = Route.useParams();
  return <ShopScreen key={shopId} shopId={shopId} />;
}
