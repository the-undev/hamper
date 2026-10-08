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

/** The bar under the header, shown only when offline or with changes not yet sent. */
export function StatusBar({ status }: { status: SyncStatus }) {
  const message = statusMessage(status);
  if (!message) {
    return null;
  }
  return (
    <p role="status" className="m-0 bg-warn-soft px-4 py-1.5 text-xs text-warn">
      {message}
    </p>
  );
}
