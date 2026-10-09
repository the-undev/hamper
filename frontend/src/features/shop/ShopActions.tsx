import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { showToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { deleteShop, restToWanted, shopText } from "@/domain/shops";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import { useSecureContext } from "@/pwa/secure";
import { useSyncLoop } from "@/store/provider";
import type { Item, Shop, ShopLine } from "@/store/types";
import { useSyncStatus } from "@/sync/loop";
import { useArchiveShop } from "./archive";
import { downloadText, shareText } from "./share";

const shareResults = {
  shared: null,
  copied: "Copied",
  unavailable: "Sharing needs the HTTPS address",
} as const;

/** Share and Download; Rest to extras, Archive and Delete, the last two after a confirm. */
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
  const loop = useSyncLoop();
  const { online } = useSyncStatus(loop);
  const archive = useArchiveShop();
  const secure = useSecureContext();
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

  const remove = async (): Promise<void> => {
    await write((w) => deleteShop(w, shop.id, nowIso()));
    await navigate({ to: "/shop" });
  };

  return (
    <>
      <div className="flex gap-2">
        {secure && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => void share()}
          >
            Share
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => downloadText(shop.name, text)}
        >
          Download
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          disabled={!anyUnticked}
          onClick={() => void write((w) => restToWanted(w, shop.id, nowIso()))}
        >
          Rest to extras
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          disabled={!online}
          onClick={() => setConfirming("archive")}
        >
          Archive
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1 text-danger"
          onClick={() => setConfirming("delete")}
        >
          Delete
        </Button>
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
        onConfirm={() => void archive(shop.id)}
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
