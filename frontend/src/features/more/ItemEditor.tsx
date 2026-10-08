import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { SavedField } from "@/components/SavedField";
import { ScreenHeader } from "@/components/ScreenHeader";
import { secondaryButton, sectionLabel } from "@/components/styles";
import { Thumb } from "@/components/Thumb";
import { TypeAhead, type TypeAheadOption } from "@/components/TypeAhead";
import { deleteItem, mergeItem, renameItem, setItemSize } from "@/domain/items";
import { itemOptions, useLiveItems } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";

const back = { to: "/more/items", label: "Items" } as const;

/** One item: its name, usual size and picture, merging it into another, and deleting it. */
export function ItemEditor({ itemId }: { itemId: string }) {
  const items = useLiveItems();
  const write = useWrite();
  const navigate = useNavigate();
  const [mergeTarget, setMergeTarget] = useState<TypeAheadOption | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!items) {
    return <ScreenHeader title="Item" back={back} />;
  }
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    return (
      <>
        <ScreenHeader title="Item" back={back} />
        <EmptyState>This item has been deleted.</EmptyState>
      </>
    );
  }
  const otherItems = items.filter((candidate) => candidate.id !== itemId);

  return (
    <>
      <ScreenHeader title="Item" back={back} />
      <div className="flex items-center gap-3">
        <Thumb name={item.name} size="row" />
        <span className="text-xs text-muted">
          Pictures arrive in a later version.
        </span>
      </div>
      <SavedField
        key={`name-${item.name}`}
        label="Name"
        value={item.name}
        save={(w, name) => renameItem(w, item.id, name)}
      />
      <SavedField
        key={`size-${item.size}`}
        label="Usual size"
        value={item.size ?? ""}
        placeholder="e.g. 1kg bag, 4 pints, tin"
        save={(w, size) => setItemSize(w, item.id, size)}
      />
      <h2 className={sectionLabel}>Merge into another item</h2>
      <TypeAhead
        label="Merge into"
        placeholder="Another item…"
        options={itemOptions(otherItems)}
        onPick={setMergeTarget}
      />
      <button
        type="button"
        className={`${secondaryButton} text-danger`}
        onClick={() => setConfirmingDelete(true)}
      >
        Delete
      </button>
      <ConfirmDialog
        open={mergeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMergeTarget(null);
          }
        }}
        title={`Merge ${item.name} into ${mergeTarget?.name ?? ""}?`}
        description={`Every line of ${item.name} moves to ${mergeTarget?.name ?? ""} and ${item.name} is removed. Two lines on one meal, day or the wanted list become one.`}
        confirmLabel="Merge"
        onConfirm={async () => {
          if (!mergeTarget) {
            return;
          }
          await write((w) => mergeItem(w, item.id, mergeTarget.id, nowIso()));
          await navigate({
            to: "/more/items/$itemId",
            params: { itemId: mergeTarget.id },
          });
        }}
      />
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${item.name}?`}
        description="It leaves every meal, day and the wanted list. Open lists keep their line, and history does not change."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          await write((w) => deleteItem(w, item.id, nowIso()));
          await navigate({ to: "/more/items" });
        }}
      />
    </>
  );
}
