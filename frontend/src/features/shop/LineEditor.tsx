import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { Counter } from "@/components/Counter";
import { textInput } from "@/components/styles";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { editShopLine, lineToWanted, removeShopLine } from "@/domain/shops";
import { useWrite } from "@/hooks/useWrite";
import { nowIso } from "@/lib/dates";
import type { ShopLineView } from "./lineView";

/** The line's own text after an edit: unchanged text keeps what the line had, anything else becomes its own. */
function editedText(
  typed: string,
  shown: string | null,
  override: string | null,
): string | null {
  return typed.trim() === (shown ?? "") ? override : typed;
}

/** Edits one line's name, size and count on this list only, or sends it to wanted or removes it. */
export function LineEditor({
  view,
  onClose,
}: {
  view: ShopLineView | null;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={view !== null} onClose={onClose}>
      {view && (
        <LineEditorFields key={view.line.id} view={view} onClose={onClose} />
      )}
    </BottomSheet>
  );
}

function LineEditorFields({
  view,
  onClose,
}: {
  view: ShopLineView;
  onClose: () => void;
}) {
  const write = useWrite();
  const { line } = view;
  const [name, setName] = useState(view.name);
  const [size, setSize] = useState(view.size ?? "");
  const [count, setCount] = useState(line.count);

  const close = async (fn: Parameters<typeof write>[0]): Promise<void> => {
    await write(fn);
    onClose();
  };

  return (
    <>
      <SheetTitle className="text-lg font-bold">{view.name}</SheetTitle>
      <SheetDescription className="text-xs text-muted">
        {line.sources.length > 0
          ? `From ${line.sources.join(", ")}. Changes here are for this list only.`
          : "Changes here are for this list only."}
      </SheetDescription>
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
          Size
          <input
            value={size}
            placeholder="e.g. small bag"
            onChange={(event) => setSize(event.target.value)}
            className={textInput}
          />
        </label>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">Count</span>
        <Counter count={count} subject={view.name} onChange={setCount} />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void close((w) => lineToWanted(w, line.id, nowIso()))}
          className="min-h-11 flex-1 rounded-[10px] border border-warn text-[13px] font-semibold text-warn"
        >
          To wanted
        </button>
        <button
          type="button"
          onClick={() =>
            void close((w) => removeShopLine(w, line.id, nowIso()))
          }
          className="min-h-11 flex-1 rounded-[10px] border border-line text-[13px] font-semibold text-muted"
        >
          Remove
        </button>
        <button
          type="button"
          onClick={() =>
            void close((w) =>
              editShopLine(w, line.id, {
                nameOverride: editedText(name, view.name, line.nameOverride),
                sizeOverride: editedText(size, view.size, line.sizeOverride),
                count,
              }),
            )
          }
          className="min-h-11 flex-1 rounded-[10px] bg-accent text-[13px] font-semibold text-accent-foreground"
        >
          Done
        </button>
      </div>
    </>
  );
}
