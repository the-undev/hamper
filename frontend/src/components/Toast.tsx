import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast | null>(null);

const toastMilliseconds = 2500;

/** Shows one short message at a time near the bottom of the screen. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((nextMessage: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setMessage(nextMessage);
    timer.current = setTimeout(() => setMessage(null), toastMilliseconds);
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
        {message && (
          <span className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg">
            {message}
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
