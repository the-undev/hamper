import {
  type AddLine,
  type AddReceipt,
  addNamed,
  addPicked,
  undoAdd,
} from "@/domain/adds";
import { itemOptions, useLiveItems } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import type { Writer } from "@/store/write";
import { useToast } from "./Toast";
import { TypeAhead } from "./TypeAhead";

/** How long the toast after an add offers Undo. */
const undoMilliseconds = 5000;

/** The type-ahead over live items: a pick or a new name becomes an item, which addLine puts on its list in the same write; a toast then offers Undo. */
export function ItemTypeAhead({
  label,
  placeholder,
  addLine,
}: {
  label: string;
  placeholder: string;
  addLine: AddLine;
}) {
  const items = useLiveItems();
  const write = useWrite();
  const showToast = useToast();

  const add = async (
    name: string,
    fn: (w: Writer) => Promise<AddReceipt>,
  ): Promise<void> => {
    const receipt = await write(fn);
    if (!receipt) {
      return;
    }
    showToast(`Added ${name}`, {
      label: "Undo",
      onAction: () => void write((w) => undoAdd(w, receipt, nowIso())),
      closesAfterMs: undoMilliseconds,
    });
  };

  return (
    <TypeAhead
      label={label}
      placeholder={placeholder}
      options={itemOptions(items ?? [])}
      onPick={(option) =>
        void add(option.name, (w) => addPicked(w, option.id, addLine))
      }
      create={{
        label: (name) => `Add “${name}”`,
        onCreate: (name) => void add(name, (w) => addNamed(w, name, addLine)),
      }}
    />
  );
}
