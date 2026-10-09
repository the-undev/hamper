import { liveRows, useLive } from "@/store/live";
import { useDb } from "@/store/provider";
import type { Shop, ShopLine } from "@/store/types";

/** An open shop with how many of its lines are ticked, out of how many. */
export interface OpenShop {
  shop: Shop;
  got: number;
  lineCount: number;
}

/** The open shops, newest first, each with how many of its lines are got. */
export function useOpenShops(): OpenShop[] | undefined {
  const db = useDb();
  return useLive(async () => {
    const shops = liveRows(await db.shops.toArray()).sort((first, second) =>
      second.createdAt.localeCompare(first.createdAt),
    );
    const lines = liveRows(await db.shopLines.toArray());
    return shops.map((shop) => {
      const shopLines = lines.filter((line) => line.shopId === shop.id);
      return {
        shop,
        got: shopLines.filter((line) => line.ticked).length,
        lineCount: shopLines.length,
      };
    });
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
