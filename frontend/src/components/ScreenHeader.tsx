import { Link } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";
import type { FileRouteTypes } from "@/routeTree.gen";

/** The element in the shell's header that each screen fills. */
export const HeaderSlotContext = createContext<HTMLElement | null>(null);

/** A path with no parameters, for a back link. */
export type PlainPath = Exclude<FileRouteTypes["to"], `${string}$${string}`>;

/** Puts the screen's title, back link and actions into the shell's header. */
export function ScreenHeader({
  title,
  back,
  actions,
}: {
  title: string;
  back?: { to: PlainPath; label: string };
  actions?: ReactNode;
}) {
  const slot = useContext(HeaderSlotContext);
  if (!slot) {
    return null;
  }
  return createPortal(
    <>
      <div className="flex min-w-0 items-center gap-1">
        {back && (
          <Link
            to={back.to}
            className="-ml-2 flex min-h-11 min-w-11 items-center px-2 text-sm font-semibold text-accent"
          >
            ‹ {back.label}
          </Link>
        )}
        <h1 className="m-0 truncate text-xl font-bold">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-1.5">{actions}</div>}
    </>,
    slot,
  );
}
