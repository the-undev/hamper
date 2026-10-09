import { createContext, type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";

/** The element above the tab bar that an editing screen fills with its footer. */
export const FooterSlotContext = createContext<HTMLElement | null>(null);

/** Puts an editing screen's closing actions, Done last, in a bar that stays above the tab bar. */
export function ScreenFooter({ children }: { children: ReactNode }) {
  const slot = useContext(FooterSlotContext);
  if (!slot) {
    return null;
  }
  return createPortal(
    <fieldset
      aria-label="Screen actions"
      className="m-0 flex min-w-0 gap-2 border-line border-t bg-surface px-4 py-2.5 *:flex-1"
    >
      {children}
    </fieldset>,
    slot,
  );
}
