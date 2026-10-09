import { type ReactNode, useEffect, useRef } from "react";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { Sheet, SheetContent } from "./ui/sheet";

/** The gap in px left above the focused field when the sheet scrolls it into view. */
const fieldMargin = 16;

/** Scrolls the sheet, never the page, so the focused field inside it sits at its top with what follows it under it. */
function bringFocusedFieldUp(sheet: HTMLElement): void {
  const field = document.activeElement;
  if (!(field instanceof HTMLElement) || !sheet.contains(field)) {
    return;
  }
  const fieldTop = field.getBoundingClientRect().top;
  const sheetTop = sheet.getBoundingClientRect().top;
  sheet.scrollTop += fieldTop - sheetTop - fieldMargin;
}

/** A sheet that rises from the bottom of the column and stays above the phone's keyboard; closing it by a tap outside or Escape calls onClose. */
export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { inset, visibleHeight } = useKeyboardInset();
  const sheetRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the sizes are the trigger; the sheet scrolls again each time the keyboard changes them.
  useEffect(() => {
    if (sheetRef.current) {
      bringFocusedFieldUp(sheetRef.current);
    }
  }, [inset, visibleHeight]);

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
        ref={sheetRef}
        side="bottom"
        showCloseButton={false}
        style={{
          bottom: `${inset}px`,
          maxHeight:
            visibleHeight === null
              ? undefined
              : `min(85dvh, ${visibleHeight}px)`,
        }}
        className="mx-auto max-h-[85dvh] max-w-(--column-max) overflow-y-auto overscroll-contain rounded-t-2xl bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]"
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}
