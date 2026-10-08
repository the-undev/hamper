import { useNavigate } from "@tanstack/react-router";
import { secondaryButton } from "@/components/styles";
import { startEmptyShop } from "@/domain/shops";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, localIsoDate, nowIso } from "@/lib/dates";

/** "Make from plan", which opens the breakdown, and "Start empty", which opens a new list for a quick trip. */
export function ShopStarters({ onStarted }: { onStarted: () => void }) {
  const write = useWrite();
  const navigate = useNavigate();
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className={secondaryButton}
        onClick={() => {
          onStarted();
          void navigate({ to: "/shop/breakdown" });
        }}
      >
        Make from plan
      </button>
      <button
        type="button"
        className={secondaryButton}
        onClick={async () => {
          const name = `Quick shop ${formatDay(localIsoDate(new Date()))}`;
          const shop = await write((w) => startEmptyShop(w, name, nowIso()));
          if (!shop) {
            return;
          }
          onStarted();
          await navigate({ to: "/shop/$shopId", params: { shopId: shop.id } });
        }}
      >
        Start empty
      </button>
    </div>
  );
}
