import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/** A button on a toast, which runs and closes the toast. */
export interface ToastAction {
  label: string;
  onAction: () => void;
  /** How long the toast stays untouched before it closes; null keeps it until it is taken or replaced. */
  closesAfterMs: number | null;
}

type ShowToast = (message: string, action?: ToastAction) => void;

interface ToastMessage {
  message: string;
  action: ToastAction | undefined;
}

const ToastContext = createContext<ShowToast | null>(null);

const toastMilliseconds = 2500;

/** Shows one short message at a time near the bottom of the screen; a message with an action stays as long as the action says. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, action?: ToastAction) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setToast({ message, action });
    const lifetime = action ? action.closesAfterMs : toastMilliseconds;
    if (lifetime === null) {
      return;
    }
    timer.current = setTimeout(() => setToast(null), lifetime);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return (
    <ToastContext value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4"
      >
        {toast && (
          <span
            className={cn(
              "flex items-center gap-3 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg",
              toast.action && "pointer-events-auto",
            )}
          >
            {toast.message}
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  setToast(null);
                  toast.action?.onAction();
                }}
                className="-my-2.5 -mr-2 min-h-11 rounded-full px-3 underline underline-offset-2"
              >
                {toast.action.label}
              </button>
            )}
          </span>
        )}
      </div>
    </ToastContext>
  );
}

/** Returns the function that shows a toast. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) {
    throw new Error("useToast needs a ToastProvider above it");
  }
  return show;
}
