import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { archiveShop, historyKey, RestError } from "@/api/rest";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { secondaryButton } from "@/components/styles";
import { useToast } from "@/components/Toast";
import { deleteShop, restToWanted, shopText } from "@/domain/shops";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import { useSyncLoop } from "@/store/provider";
import type { Item, Shop, ShopLine } from "@/store/types";
import { useSyncStatus } from "@/sync/loop";
import { downloadText, shareText } from "./share";

const shareResults = {
  shared: null,
  copied: "Copied",
  unavailable: "Sharing needs the HTTPS address",
} as const;

/** Share and Download; Rest to wanted, Archive and Delete, the last two after a confirm. */
export function ShopActions({
  shop,
  lines,
  itemsById,
}: {
  shop: Shop;
  lines: readonly ShopLine[];
  itemsById: ReadonlyMap<string, Item>;
}) {
  const write = useWrite();
  const navigate = useNavigate();
  const showToast = useToast();
  const loop = useSyncLoop();
  const { online } = useSyncStatus(loop);
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(
    null,
  );
  const text = shopText(shop, lines, [...itemsById.values()]);
  const anyUnticked = lines.some((line) => !line.ticked);

  const share = async (): Promise<void> => {
    const message = shareResults[await shareText(shop.name, text)];
    if (message) {
      showToast(message);
    }
  };

  const archive = async (): Promise<void> => {
    try {
      // The server can only archive a shop it has; the push sends one made offline.
      await loop.syncNow();
      await archiveShop(shop.id);
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

  const remove = async (): Promise<void> => {
    await write((w) => deleteShop(w, shop.id, nowIso()));
    await navigate({ to: "/shop" });
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          className={secondaryButton}
          onClick={() => void share()}
        >
          Share
        </button>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => downloadText(shop.name, text)}
        >
          Download
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className={secondaryButton}
          disabled={!anyUnticked}
          onClick={() => void write((w) => restToWanted(w, shop.id, nowIso()))}
        >
          Rest to wanted
        </button>
        <button
          type="button"
          className={secondaryButton}
          disabled={!online}
          onClick={() => setConfirming("archive")}
        >
          Archive
        </button>
        <button
          type="button"
          className={`${secondaryButton} text-danger`}
          onClick={() => setConfirming("delete")}
        >
          Delete
        </button>
      </div>
      {!online && (
        <p className="m-0 text-xs text-muted">
          Archiving needs a connection to the server.
        </p>
      )}
      <ConfirmDialog
        open={confirming === "archive"}
        onOpenChange={(open) => setConfirming(open ? "archive" : null)}
        title={`Archive ${shop.name}?`}
        description="The list moves to history as it stands. The plan does not change."
        confirmLabel="Archive"
        onConfirm={() => void archive()}
      />
      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(open) => setConfirming(open ? "delete" : null)}
        title={`Delete ${shop.name}?`}
        description="The list is discarded and not kept in history. The plan does not change."
        confirmLabel="Delete"
        danger
        onConfirm={() => void remove()}
      />
    </>
  );
}
