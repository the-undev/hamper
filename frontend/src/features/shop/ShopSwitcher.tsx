import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOpenShops } from "./data";
import { ShopStarters } from "./ShopStarters";

/** The row of open lists to switch between, and + to start another. */
export function ShopSwitcher({ currentShopId }: { currentShopId: string }) {
  const openShops = useOpenShops();
  const [starting, setStarting] = useState(false);
  return (
    <nav
      aria-label="Lists"
      className="flex gap-1 rounded-xl bg-background p-[3px]"
    >
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {(openShops ?? []).map(({ shop, toGet }) => (
          <Link
            key={shop.id}
            to="/shop/$shopId"
            params={{ shopId: shop.id }}
            aria-current={shop.id === currentShopId ? "page" : undefined}
            className="flex min-h-11 min-w-28 flex-1 flex-col justify-center rounded-[10px] px-2 text-center text-sm font-semibold text-muted aria-[current=page]:bg-surface aria-[current=page]:text-foreground aria-[current=page]:shadow-[0_1px_3px_rgba(0,0,0,.12)]"
          >
            <span className="truncate">{shop.name}</span>
            <small className="text-[11px] font-medium">{toGet} to get</small>
          </Link>
        ))}
      </div>
      <button
        type="button"
        aria-label="Start another list"
        onClick={() => setStarting(true)}
        className="grid size-11 flex-none place-items-center rounded-[10px] text-lg font-semibold text-accent hover:bg-soft"
      >
        +
      </button>
      <Sheet open={starting} onOpenChange={setStarting}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="mx-auto max-w-(--column-max) rounded-t-2xl bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]"
        >
          <SheetTitle className="text-lg font-bold">
            Start another list
          </SheetTitle>
          <SheetDescription className="text-xs text-muted">
            It sits beside the lists already open.
          </SheetDescription>
          <ShopStarters onStarted={() => setStarting(false)} />
        </SheetContent>
      </Sheet>
    </nav>
  );
}
