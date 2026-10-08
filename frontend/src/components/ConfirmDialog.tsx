import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Asks before an action that cannot be undone; Cancel and the confirm button both close it. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  danger = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="bg-surface">
        <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
        <DialogDescription className="text-sm text-muted">
          {description}
        </DialogDescription>
        <div className="flex gap-2">
          <DialogClose className="min-h-11 flex-1 rounded-[10px] border border-line font-semibold">
            Cancel
          </DialogClose>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
            className={cn(
              "min-h-11 flex-1 rounded-[10px] font-semibold",
              danger
                ? "bg-danger text-white"
                : "bg-accent text-accent-foreground",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
