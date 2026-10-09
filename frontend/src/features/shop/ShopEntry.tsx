import { Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { formatTimestampDay } from "@/lib/dates";
import { type OpenShop, useOpenShops } from "./data";
import { ShopStarters } from "./ShopStarters";

/** The open lists as cards, newest first, then the two ways to start another; with none open, a note says so. */
export function ShopEntry() {
  const openShops = useOpenShops();
  if (!openShops) {
    return <ScreenHeader title="Shop" />;
  }
  return (
    <>
      <ScreenHeader title="Shop" />
      {openShops.length === 0 ? (
        <EmptyState>
          No shopping list open. Make one from the plan when the week is sorted,
          or start an empty one for a quick trip.
        </EmptyState>
      ) : (
        <ul
          aria-label="Open lists"
          className="m-0 flex list-none flex-col gap-2.5 p-0"
        >
          {openShops.map((openShop) => (
            <li key={openShop.shop.id}>
              <ShopCard openShop={openShop} />
            </li>
          ))}
        </ul>
      )}
      <ShopStarters />
    </>
  );
}

/** One open list: its name, how many lines are got, the day it was made and a bar of the same progress; tapping it opens the list. */
function ShopCard({ openShop }: { openShop: OpenShop }) {
  const { shop, got, lineCount } = openShop;
  const gotPercent = (got / Math.max(lineCount, 1)) * 100;
  return (
    <Link
      to="/shop/$shopId"
      params={{ shopId: shop.id }}
      className="flex min-h-11 flex-col gap-1.5 rounded-[14px] border border-line p-3"
    >
      <span className="flex items-baseline justify-between gap-2">
        <b className="truncate text-[15px]">{shop.name}</b>
        <small className="flex-none text-xs text-muted">
          {got} of {lineCount} got
        </small>
      </span>
      <small className="text-xs text-muted">
        Made {formatTimestampDay(shop.createdAt)}
      </small>
      <span aria-hidden className="h-1 overflow-hidden rounded-full bg-line">
        <span
          className="block h-full rounded-full bg-tick"
          style={{ width: `${gotPercent}%` }}
        />
      </span>
    </Link>
  );
}
