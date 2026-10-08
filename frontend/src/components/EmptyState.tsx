import type { ReactNode } from "react";

/** A dashed box saying there is nothing to show yet. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-line p-3.5 text-center text-sm text-muted">
      {children}
    </div>
  );
}
