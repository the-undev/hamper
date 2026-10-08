import { liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";
import type { Shop, ShopLine } from "@/store/types";

/** The setting that remembers which list was open last. */
export const lastShopSetting = "shopId";

/** The open shops, oldest first, each with how many of its lines are still to get. */
export function useOpenShops(): { shop: Shop; toGet: number }[] | undefined {
  const db = useDb();
  return useLive(async () => {
    const shops = liveRows(await db.shops.toArray()).sort((first, second) =>
      first.createdAt.localeCompare(second.createdAt),
    );
    const unticked = liveRows(await db.shopLines.toArray()).filter(
      (line) => !line.ticked,
    );
    return shops.map((shop) => ({
      shop,
      toGet: unticked.filter((line) => line.shopId === shop.id).length,
    }));
  }, [db]);
}

/** One open shop and its live lines; null when the shop is gone. */
export function useShop(
  shopId: string,
): { shop: Shop; lines: ShopLine[] } | null | undefined {
  const db = useDb();
  return useLive(async () => {
    const shop = await db.shops.get(shopId);
    if (!shop || shop.deletedAt !== null) {
      return null;
    }
    const lines = liveRows(
      await db.shopLines.where("shopId").equals(shopId).toArray(),
    );
    return { shop, lines };
  }, [db, shopId]);
}
