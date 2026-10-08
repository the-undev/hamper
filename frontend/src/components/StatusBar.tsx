import type { SyncStatus } from "@/sync/loop";

/** The bar's text for a sync status: offline first, then the rows waiting to be sent, else nothing. */
export function statusMessage(status: SyncStatus): string | null {
  if (!status.online) {
    return "Offline. Changes are kept on this phone.";
  }
  if (status.pending === 0) {
    return null;
  }
  return status.pending === 1
    ? "1 change to send"
    : `${status.pending} changes to send`;
}

/** The bars under the header: Update ready when a new version waits, and the sync message when there is one. */
export function StatusBar({
  status,
  updateReady,
  onReload,
}: {
  status: SyncStatus;
  updateReady: boolean;
  onReload: () => void;
}) {
  const message = statusMessage(status);
  return (
    <>
      {updateReady && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 bg-soft px-4 py-1 text-xs font-semibold"
        >
          <span>Update ready</span>
          <button
            type="button"
            onClick={onReload}
            className="min-h-11 rounded-[10px] bg-accent px-4 text-sm font-semibold text-accent-foreground"
          >
            Reload
          </button>
        </div>
      )}
      {message && (
        <p
          role="status"
          className="m-0 bg-warn-soft px-4 py-1.5 text-xs text-warn"
        >
          {message}
        </p>
      )}
    </>
  );
}
