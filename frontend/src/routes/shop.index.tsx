import { createFileRoute } from "@tanstack/react-router";
import { ShopEntry } from "@/features/shop/ShopEntry";

export const Route = createFileRoute("/shop/")({
  component: ShopEntry,
});
