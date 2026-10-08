import { Link } from "@tanstack/react-router";
import { type ChangeEvent, useState } from "react";
import { importExport, RestError } from "@/api/rest";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint } from "@/components/styles";
import { useLiveItems } from "@/hooks/data";
import { formatTime, formatTimestampDay } from "@/lib/dates";
import { useSyncLoop } from "@/store/provider";
import { type SyncStatus, useSyncStatus } from "@/sync/loop";

const menuRow =
  "flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 border-line border-t px-3.5 py-3 text-left text-[15px] font-medium first:border-t-0 hover:bg-soft";

/** The sync status as a sentence: when the last sync finished, whether offline, and the last problem. */
export function syncSummary(status: SyncStatus): string {
  const lastSync = status.lastSyncAt
    ? `Last synced ${formatTimestampDay(status.lastSyncAt)} at ${formatTime(status.lastSyncAt)}.`
    : "Not synced yet.";
  const offline = status.online ? "" : " Offline now.";
  const problem = status.lastError
    ? ` The server refused the last changes: ${status.lastError}.`
    : "";
  return `${lastSync}${offline}${problem}`;
}

/** The menu: Items, History, Export, Import, and the sync status. */
export function MoreScreen() {
  const items = useLiveItems();
  const loop = useSyncLoop();
  const status = useSyncStatus(loop);
  const [importResult, setImportResult] = useState<string | null>(null);

  const importFile = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }
    setImportResult("Importing…");
    try {
      await importExport(file);
    } catch (error) {
      if (!(error instanceof RestError)) {
        throw error;
      }
      setImportResult(error.title);
      return;
    }
    setImportResult("Imported");
    await loop.syncNow();
  };

  return (
    <>
      <ScreenHeader title="More" />
      <div className="flex flex-col overflow-hidden rounded-[14px] border border-line">
        <Link to="/more/items" className={menuRow}>
          Items
          <small className="text-muted">{items?.length ?? 0} known</small>
        </Link>
        <Link to="/more/history" className={menuRow}>
          History
          <small className="text-muted">archived shops</small>
        </Link>
        <a href="/api/export" download className={menuRow}>
          Export everything
          <small className="text-muted">one file</small>
        </a>
        <label className={menuRow}>
          Import
          <small className="text-muted">into an empty instance</small>
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => void importFile(event)}
            className="sr-only"
          />
        </label>
      </div>
      {importResult && (
        <p aria-live="polite" className="m-0 text-sm font-semibold">
          {importResult}
        </p>
      )}
      <p className={hint}>{syncSummary(status)}</p>
    </>
  );
}
