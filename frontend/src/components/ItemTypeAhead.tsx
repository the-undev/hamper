import { ensureItem } from "@/domain/items";
import { itemOptions, useLiveItems } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import type { Writer } from "@/store/write";
import { TypeAhead } from "./TypeAhead";

/** The type-ahead over live items: a pick or a new name becomes an item, which addLine puts on its list in the same write. */
export function ItemTypeAhead({
  label,
  placeholder,
  addLine,
}: {
  label: string;
  placeholder: string;
  addLine: (w: Writer, itemId: string) => Promise<void>;
}) {
  const items = useLiveItems();
  const write = useWrite();
  return (
    <TypeAhead
      label={label}
      placeholder={placeholder}
      options={itemOptions(items ?? [])}
      onPick={(option) => void write((w) => addLine(w, option.id))}
      create={{
        label: (name) => `Add “${name}”`,
        onCreate: (name) =>
          void write(async (w) => addLine(w, (await ensureItem(w, name)).id)),
      }}
    />
  );
}
