import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { HeaderSlotContext } from "@/components/ScreenHeader";
import { StatusBar } from "@/components/StatusBar";
import { TabBar } from "@/components/TabBar";
import { useSyncLoop } from "@/store/provider";
import { useSyncStatus } from "@/sync/loop";

export const Route = createRootRoute({
  component: Shell,
  notFoundComponent: () => (
    <p className="text-sm text-muted">There is nothing at this address.</p>
  ),
});

/** The header, the status bar, the screen and the tab bar, in a column a phone wide. */
function Shell() {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const status = useSyncStatus(useSyncLoop());
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface min-[480px]:border-line min-[480px]:border-x">
      <div className="sticky top-0 z-10 bg-surface">
        <header
          ref={setHeaderSlot}
          className="flex min-h-14 items-center justify-between gap-2 border-line border-b px-4 pt-[max(10px,env(safe-area-inset-top,0px))] pb-2.5"
        />
        <StatusBar status={status} />
      </div>
      <main className="flex flex-1 flex-col gap-3.5 px-4 pt-3 pb-6">
        <HeaderSlotContext value={headerSlot}>
          <Outlet />
        </HeaderSlotContext>
      </main>
      <TabBar />
    </div>
  );
}
