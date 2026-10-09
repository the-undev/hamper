import { useLiveItems } from "@/hooks/data";
import { BottomSheet } from "./BottomSheet";
import { ItemFields, ItemUsageText } from "./ItemFields";
import { SheetDescription, SheetTitle } from "./ui/sheet";

/** The item behind a line, opened by tapping the line's name: its name and usual size, where it is used, Merge and Delete. */
export function ItemSheet({
  itemId,
  onClose,
}: {
  itemId: string | null;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={itemId !== null} onClose={onClose}>
      {itemId && (
        <ItemSheetContent key={itemId} itemId={itemId} onClose={onClose} />
      )}
    </BottomSheet>
  );
}

function ItemSheetContent({
  itemId,
  onClose,
}: {
  itemId: string;
  onClose: () => void;
}) {
  const items = useLiveItems();
  const item = items?.find((candidate) => candidate.id === itemId);
  if (!items || !item) {
    return (
      <>
        <SheetTitle className="text-lg font-bold">Item</SheetTitle>
        <SheetDescription className="text-xs text-muted">
          {items ? "This item has been deleted." : ""}
        </SheetDescription>
      </>
    );
  }
  return (
    <>
      <SheetTitle className="text-lg font-bold">{item.name}</SheetTitle>
      <SheetDescription className="text-xs text-muted">
        <ItemUsageText itemId={item.id} />
      </SheetDescription>
      <ItemFields
        item={item}
        items={items}
        onDone={onClose}
        onMerged={onClose}
        onDeleted={onClose}
        footer={(primary) => primary}
      />
    </>
  );
}
