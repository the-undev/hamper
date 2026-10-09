import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { FooterSlotContext } from "@/components/ScreenFooter";
import { HeaderSlotContext } from "@/components/ScreenHeader";
import { SyncIndicator } from "@/components/SyncIndicator";
import { columnWidth } from "@/components/styles";
import { TabBar } from "@/components/TabBar";
import { useUpdateToast } from "@/pwa/update";
import { useSyncLoop } from "@/store/provider";
import { useSyncStatus } from "@/sync/loop";

export const Route = createRootRoute({
  component: Shell,
  notFoundComponent: () => (
    <p className="text-sm text-muted">There is nothing at this address.</p>
  ),
});

/** The header with the sync indicator, the screen, its footer and the tab bar, in a centred column. */
function Shell() {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [footerSlot, setFooterSlot] = useState<HTMLElement | null>(null);
  const status = useSyncStatus(useSyncLoop());
  useUpdateToast();
  return (
    <div className={`flex min-h-dvh flex-col bg-surface ${columnWidth}`}>
      <header className="sticky top-0 z-10 flex min-h-14 items-center gap-1 border-line border-b bg-surface pt-[max(10px,env(safe-area-inset-top,0px))] pr-2 pb-2.5 pl-4">
        <div
          ref={setHeaderSlot}
          className="flex min-w-0 flex-1 items-center justify-between gap-2"
        />
        <SyncIndicator status={status} />
      </header>
      <main className="flex flex-1 flex-col gap-3.5 px-4 pt-3 pb-6">
        <HeaderSlotContext value={headerSlot}>
          <FooterSlotContext value={footerSlot}>
            <Outlet />
          </FooterSlotContext>
        </HeaderSlotContext>
      </main>
      <div className="sticky bottom-0 z-10">
        <div ref={setFooterSlot} />
        <TabBar />
      </div>
    </div>
  );
}
