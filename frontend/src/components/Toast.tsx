import { toast } from "sonner";

/** A button on a toast, which runs and closes the toast. */
export interface ToastAction {
  label: string;
  onAction: () => void;
  /** How long the toast stays untouched before it closes; null keeps it until it is taken or replaced. */
  closesAfterMs: number | null;
}

/** How long a toast without an action stays. */
const toastMilliseconds = 2500;

/** Shows one short message near the bottom of the screen through Sonner, replacing any other; a message with an action stays as long as the action says. */
export function showToast(message: string, action?: ToastAction): void {
  toast.dismiss();
  if (!action) {
    toast(message, { duration: toastMilliseconds });
    return;
  }
  toast(message, {
    duration: action.closesAfterMs ?? Number.POSITIVE_INFINITY,
    action: { label: action.label, onClick: action.onAction },
  });
}
