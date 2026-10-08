import { Navigate } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { readSetting } from "@/lib/settings";
import { lastShopSetting, useOpenShops } from "./data";
import { ShopStarters } from "./ShopStarters";

/** With no list open, the two ways to start one; otherwise the list used last, or the newest. */
export function ShopEntry() {
  const openShops = useOpenShops();
  if (!openShops) {
    return <ScreenHeader title="Shop" />;
  }
  const lastShopId = readSetting(lastShopSetting);
  const shownShop =
    openShops.find(({ shop }) => shop.id === lastShopId)?.shop ??
    openShops.at(-1)?.shop;
  if (shownShop) {
    return (
      <Navigate to="/shop/$shopId" params={{ shopId: shownShop.id }} replace />
    );
  }
  return (
    <>
      <ScreenHeader title="Shop" />
      <EmptyState>
        No shopping list open. Make one from the plan when the week is sorted,
        or start an empty one for a quick trip.
      </EmptyState>
      <ShopStarters onStarted={() => {}} />
    </>
  );
}
