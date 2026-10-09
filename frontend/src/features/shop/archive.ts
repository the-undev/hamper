import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { archiveShop, historyKey, RestError } from "@/api/rest";
import { showToast } from "@/components/Toast";
import { tickShopLine } from "@/domain/shops";
import { useWrite } from "@/hooks/useWrite";
import { useSyncLoop } from "@/store/provider";
import type { ShopLine } from "@/store/types";
import { useSyncStatus } from "@/sync/loop";

/** How long the offer to archive stays untouched before it closes. */
const archiveOfferMilliseconds = 8000;

/** Archives a shop on the server, pulls the change and goes back to the lists; a refusal shows its problem in a toast. */
export function useArchiveShop(): (shopId: string) => Promise<void> {
  const loop = useSyncLoop();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (shopId) => {
    try {
      // The server can only archive a shop it has; the push sends one made offline.
      await loop.syncNow();
      await archiveShop(shopId);
      await loop.syncNow();
      await queryClient.invalidateQueries({ queryKey: historyKey });
      await navigate({ to: "/shop" });
    } catch (error) {
      if (!(error instanceof RestError)) {
        throw error;
      }
      showToast(error.title);
    }
  };
}

/** Ticks or unticks a line; a tick that leaves nothing to get offers to archive the list, or only says so while offline. */
export function useTickLine(): (
  line: ShopLine,
  ticked: boolean,
) => Promise<void> {
  const write = useWrite();
  const loop = useSyncLoop();
  const { online } = useSyncStatus(loop);
  const archive = useArchiveShop();
  return async (line, ticked) => {
    const everythingGot = await write((w) => tickShopLine(w, line.id, ticked));
    if (!everythingGot) {
      return;
    }
    if (!online) {
      showToast("Everything got");
      return;
    }
    showToast("Everything got. Archive the list?", {
      label: "Archive",
      onAction: () => void archive(line.shopId),
      closesAfterMs: archiveOfferMilliseconds,
    });
  };
}
