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

/** Reserves the width of the scroll area's scrollbar, so the header and bottom bar line up with the column. */
const gutter = "overflow-y-hidden [scrollbar-gutter:stable]";

/** The header with the sync indicator, the screen, its footer and the tab bar, in a centred column, with the screen scrolling between the header and the bottom bar. */
function Shell() {
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [footerSlot, setFooterSlot] = useState<HTMLElement | null>(null);
  const status = useSyncStatus(useSyncLoop());
  useUpdateToast();
  return (
    <div className="flex h-dvh flex-col bg-surface">
      <div className={`shrink-0 ${gutter}`}>
        <header
          className={`flex min-h-14 items-center gap-1 border-line border-b bg-surface pt-[max(10px,env(safe-area-inset-top,0px))] pr-2 pb-2.5 pl-4 ${columnWidth}`}
        >
          <div
            ref={setHeaderSlot}
            className="flex min-w-0 flex-1 items-center justify-between gap-2"
          />
          <SyncIndicator status={status} />
        </header>
      </div>
      <div
        data-scroll-area
        className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
      >
        <main
          className={`flex min-h-full flex-col gap-3.5 px-4 pt-3 pb-6 ${columnWidth}`}
        >
          <HeaderSlotContext value={headerSlot}>
            <FooterSlotContext value={footerSlot}>
              <Outlet />
            </FooterSlotContext>
          </HeaderSlotContext>
        </main>
      </div>
      <div className={`shrink-0 ${gutter}`}>
        <div className={columnWidth}>
          <div ref={setFooterSlot} />
          <TabBar />
        </div>
      </div>
    </div>
  );
}
