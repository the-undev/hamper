import { type ReactNode, useState } from "react";
import { deleteItem, mergeItem, renameItem, setItemSize } from "@/domain/items";
import { type ItemUsage, itemOptions, useItemUsage } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import type { Item } from "@/store/types";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  primaryButton,
  secondaryButton,
  sectionLabel,
  textInput,
} from "./styles";
import { TypeAhead, type TypeAheadOption } from "./TypeAhead";

/** A count and a noun, with an s when the count is not one. */
function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Says where an item is used, as "Used on 2 meals, 1 day, 1 list." */
export function usageText(usage: ItemUsage): string {
  return `Used on ${counted(usage.meals, "meal")}, ${counted(usage.days, "day")}, ${counted(usage.lists, "list")}.`;
}

/** The line saying where an item is used, empty while the store is read. */
export function ItemUsageText({ itemId }: { itemId: string }) {
  const usage = useItemUsage(itemId);
  return usage ? usageText(usage) : null;
}

/** An item's name and usual size, saved by Done, then Merge into another item and Delete; a name another item has turns Done into Merge into that item. */
export function ItemFields({
  item,
  items,
  onDone,
  onMerged,
  onDeleted,
  footer,
}: {
  item: Item;
  /** Every live item, this one included. */
  items: readonly Item[];
  onDone: () => void;
  onMerged: (targetId: string) => void;
  onDeleted: () => void;
  /** Places the Done or Merge button: a screen puts it in its footer, a sheet where it stands. */
  footer: (primary: ReactNode) => ReactNode;
}) {
  const write = useWrite();
  const [name, setName] = useState(item.name);
  const [size, setSize] = useState(item.size ?? "");
  const [mergeTarget, setMergeTarget] = useState<TypeAheadOption | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const otherItems = items.filter((candidate) => candidate.id !== item.id);
  const typedKey = name.trim().toLowerCase();
  const sameNamedItem = otherItems.find(
    (other) => other.name.toLowerCase() === typedKey,
  );

  const merge = async (targetId: string): Promise<void> => {
    const merged = await write(async (w) => {
      await mergeItem(w, item.id, targetId, nowIso());
      return true;
    });
    if (merged) {
      onMerged(targetId);
    }
  };

  const save = async (): Promise<void> => {
    const saved = await write(async (w) => {
      if (name.trim() !== item.name) {
        await renameItem(w, item.id, name);
      }
      if (size.trim() !== (item.size ?? "")) {
        await setItemSize(w, item.id, size);
      }
      return true;
    });
    if (saved) {
      onDone();
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-muted">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={textInput}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-muted">
          Usual size
          <input
            value={size}
            placeholder="e.g. 1kg bag, 4 pints, tin"
            onChange={(event) => setSize(event.target.value)}
            className={textInput}
          />
        </label>
      </div>
      <h2 className={sectionLabel}>Merge into another item</h2>
      <TypeAhead
        label="Merge into"
        placeholder="Another item…"
        options={itemOptions(otherItems)}
        onPick={setMergeTarget}
      />
      <button
        type="button"
        className={`${secondaryButton} flex-none text-danger`}
        onClick={() => setConfirmingDelete(true)}
      >
        Delete item
      </button>
      {footer(
        sameNamedItem ? (
          <button
            type="button"
            className={primaryButton}
            onClick={() => void merge(sameNamedItem.id)}
          >
            Merge into {sameNamedItem.name}
          </button>
        ) : (
          <button
            type="button"
            className={primaryButton}
            onClick={() => void save()}
          >
            Done
          </button>
        ),
      )}
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
        onConfirm={() => {
          if (mergeTarget) {
            void merge(mergeTarget.id);
          }
        }}
      />
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${item.name}?`}
        description={`${item.name} and its lines leave every meal, day and the wanted list. Open lists keep their line under its name, and history does not change.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          await write((w) => deleteItem(w, item.id, nowIso()));
          onDeleted();
        }}
      />
    </>
  );
}
