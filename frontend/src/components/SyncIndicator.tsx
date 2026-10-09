import { CloudOff, LoaderCircle } from "lucide-react";
import type { SyncStatus } from "@/sync/loop";

/** The indicator's accessible name for a sync status: offline first, then sending, then the rows waiting, else none. */
export function syncStateLabel(status: SyncStatus): string | undefined {
  if (!status.online) {
    return "Offline. Changes are kept on this phone.";
  }
  if (status.syncing) {
    return "Syncing";
  }
  if (status.pending === 0) {
    return undefined;
  }
  return status.pending === 1
    ? "1 change to send"
    : `${status.pending} changes to send`;
}

/** A fixed slot at the header's right end showing the sync state: nothing when synced, a spinner, a count of changes to send, or offline. */
export function SyncIndicator({ status }: { status: SyncStatus }) {
  const label = syncStateLabel(status);
  return (
    <div
      role="status"
      aria-label={label}
      title={label}
      className="flex h-11 w-9 flex-none items-center justify-center"
    >
      <SyncGlyph status={status} />
    </div>
  );
}

/** The picture for a sync status, hidden from screen readers since the slot carries the name. */
function SyncGlyph({ status }: { status: SyncStatus }) {
  if (!status.online) {
    return <CloudOff aria-hidden className="size-5 text-warn" />;
  }
  if (status.syncing) {
    return (
      <LoaderCircle
        aria-hidden
        className="size-4 animate-spin text-muted motion-reduce:animate-none"
      />
    );
  }
  if (status.pending === 0) {
    return null;
  }
  return (
    <span
      aria-hidden
      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-warn-soft px-1.5 text-[11px] font-bold text-warn tabular-nums"
    >
      {status.pending}
    </span>
  );
}
