import { useNavigate } from "@tanstack/react-router";
import { useLeave } from "@/components/DoneButton";
import { EmptyState } from "@/components/EmptyState";
import { ItemFields, ItemUsageText } from "@/components/ItemFields";
import { Picture } from "@/components/Picture";
import { ScreenFooter } from "@/components/ScreenFooter";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint } from "@/components/styles";
import { CropUpload } from "@/features/images/CropUpload";
import { useLiveItems } from "@/hooks/data";

const back = { to: "/more/items", label: "Items" } as const;

/** One item: its picture, then the fields the item sheet shows, with Done in the footer. */
export function ItemEditor({ itemId }: { itemId: string }) {
  const items = useLiveItems();
  const navigate = useNavigate();
  const leave = useLeave("/more/items");

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

  return (
    <>
      <ScreenHeader title="Item" back={back} />
      <div className="flex items-start gap-3">
        <Picture name={item.name} imageId={item.imageId} size="row" />
        <div className="flex-1">
          <CropUpload
            table="items"
            rowId={item.id}
            hasImage={item.imageId !== null}
          />
        </div>
      </div>
      <p className={hint}>
        <ItemUsageText itemId={item.id} />
      </p>
      <ItemFields
        key={item.id}
        item={item}
        items={items}
        onDone={leave}
        onMerged={(targetId) =>
          void navigate({
            to: "/more/items/$itemId",
            params: { itemId: targetId },
          })
        }
        onDeleted={() => void navigate({ to: "/more/items" })}
        footer={(primary) => <ScreenFooter>{primary}</ScreenFooter>}
      />
    </>
  );
}
