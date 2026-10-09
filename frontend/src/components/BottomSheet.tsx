import type { ReactNode } from "react";
import { Sheet, SheetContent } from "./ui/sheet";

/** A sheet that rises from the bottom of the column; closing it by a tap outside or Escape calls onClose. */
export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-w-(--column-max) rounded-t-2xl bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]"
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}
