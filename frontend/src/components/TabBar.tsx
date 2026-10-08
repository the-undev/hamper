import { Link } from "@tanstack/react-router";
import type { PlainPath } from "./ScreenHeader";

const tabs: readonly { to: PlainPath; label: string; glyph: string }[] = [
  { to: "/plan", label: "Plan", glyph: "▤" },
  { to: "/shop", label: "Shop", glyph: "✓" },
  { to: "/meals", label: "Meals", glyph: "◍" },
  { to: "/more", label: "More", glyph: "⋯" },
];

/** The four tabs along the bottom, clear of the phone's home bar. */
export function TabBar() {
  return (
    <nav
      aria-label="Tabs"
      className="sticky bottom-0 z-10 flex border-line border-t bg-surface px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))]"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className="group flex min-h-11 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-semibold text-muted data-[status=active]:text-accent"
        >
          <span
            aria-hidden="true"
            className="grid size-6.5 place-items-center rounded-lg bg-line text-[13px] text-foreground group-data-[status=active]:bg-soft group-data-[status=active]:text-accent"
          >
            {tab.glyph}
          </span>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
