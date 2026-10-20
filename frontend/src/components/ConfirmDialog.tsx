import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-surface">
        <AlertDialogTitle className="text-lg font-bold">
          {title}
        </AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="text-sm text-muted">{description}</div>
        </AlertDialogDescription>
        <div className="flex gap-2">
          <AlertDialogCancel
            size="lg"
            className="flex-1 rounded-[10px] text-base"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant={danger ? "destructive" : "default"}
            size="lg"
            onClick={onConfirm}
            className="flex-1 rounded-[10px] text-base font-semibold"
          >
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
