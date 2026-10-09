import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { startEmptyShop } from "@/domain/shops";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, localIsoDate, nowIso } from "@/lib/dates";

/** "Make from plan", which opens the breakdown, and "Start empty", which opens a new list for a quick trip. */
export function ShopStarters() {
  const write = useWrite();
  const navigate = useNavigate();
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="flex-1"
        onClick={() => void navigate({ to: "/shop/breakdown" })}
      >
        Make from plan
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="flex-1"
        onClick={async () => {
          const name = `Quick shop ${formatDay(localIsoDate(new Date()))}`;
          const shop = await write((w) => startEmptyShop(w, name, nowIso()));
          if (!shop) {
            return;
          }
          await navigate({ to: "/shop/$shopId", params: { shopId: shop.id } });
        }}
      >
        Start empty
      </Button>
    </div>
  );
}
