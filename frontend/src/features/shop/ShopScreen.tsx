import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ItemTypeAhead } from "@/components/ItemTypeAhead";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint, listBox, sectionLabel } from "@/components/styles";
import { addShopLine } from "@/domain/shops";
import { useItemsById } from "@/hooks/data";
import { nowIso } from "@/lib/dates";
import { writeSetting } from "@/lib/settings";
import type { Shop } from "@/store/types";
import { lastShopSetting, useShop } from "./data";
import { LineEditor } from "./LineEditor";
import { type ShopLineView, shopLineViews } from "./lineView";
import { ShopActions } from "./ShopActions";
import { ShopLineRow } from "./ShopLineRow";
import { ShopSwitcher } from "./ShopSwitcher";

/** The list's status: its name, how many meals it came from, and how many lines are in the trolley. */
export function shopStatus(
  shop: Shop,
  tickedCount: number,
  lineCount: number,
): string {
  const origin = shop.fromPlan
    ? `${shop.name}, from ${shop.meals.length} meals.`
    : `${shop.name}.`;
  return `${origin} ${tickedCount} of ${lineCount} in the trolley.`;
}

/** One open list: the switcher, the status, the type-ahead, the lines to get and those in the trolley, and the list's actions. */
export function ShopScreen({ shopId }: { shopId: string }) {
  const shopState = useShop(shopId);
  const itemsById = useItemsById();
  const [editedLineId, setEditedLineId] = useState<string | null>(null);
  const toGetId = useId();
  const trolleyId = useId();

  useEffect(() => {
    writeSetting(lastShopSetting, shopId);
  }, [shopId]);

  if (shopState === null) {
    return (
      <>
        <ScreenHeader title="Shop" />
        <EmptyState>
          This list is closed.{" "}
          <Link to="/shop" className="font-semibold text-accent">
            Open another
          </Link>
        </EmptyState>
      </>
    );
  }
  if (!shopState || !itemsById) {
    return <ScreenHeader title="Shop" />;
  }

  const { shop, lines } = shopState;
  const views = shopLineViews(lines, itemsById);
  const toGet = views.filter((view) => !view.line.ticked);
  const inTrolley = views.filter((view) => view.line.ticked);
  const editedView =
    views.find((view) => view.line.id === editedLineId) ?? null;
  const renderRows = (rows: ShopLineView[]) => (
    <ul className={`${listBox} m-0 list-none p-0`}>
      {rows.map((view) => (
        <li
          key={view.line.id}
          className="border-line border-t first:border-t-0"
        >
          <ShopLineRow
            view={view}
            onEdit={() => setEditedLineId(view.line.id)}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <ScreenHeader title="Shop" />
      <ShopSwitcher currentShopId={shop.id} />
      <p className={hint}>{shopStatus(shop, inTrolley.length, views.length)}</p>
      <ItemTypeAhead
        label="Add to this list"
        placeholder="Add something to this list…"
        addLine={async (w, itemId) => {
          await addShopLine(w, shop.id, itemId, nowIso());
        }}
      />
      <section aria-labelledby={toGetId} className="flex flex-col gap-2">
        <h2 id={toGetId} className="sr-only">
          To get
        </h2>
        {toGet.length > 0 ? (
          renderRows(toGet)
        ) : (
          <EmptyState>
            {views.length > 0
              ? "Everything is in the trolley"
              : "Nothing on this list yet"}
          </EmptyState>
        )}
      </section>
      {inTrolley.length > 0 && (
        <section aria-labelledby={trolleyId} className="flex flex-col gap-2">
          <h2 id={trolleyId} className={sectionLabel}>
            In the trolley
          </h2>
          {renderRows(inTrolley)}
        </section>
      )}
      <ShopActions shop={shop} lines={lines} itemsById={itemsById} />
      <LineEditor view={editedView} onClose={() => setEditedLineId(null)} />
    </>
  );
}
