import { useQuery } from "@tanstack/react-query";
import { fetchArchivedShop, historyKey } from "@/api/rest";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint, listBox, sectionLabel } from "@/components/styles";
import { dayDate } from "@/domain/display";
import { formatDay, formatTimestampDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { CopyMealsButton } from "./CopyMealsButton";

const back = { to: "/more/history", label: "History" } as const;

/** One archived shop, read only: its meals by day and its lines as they were. */
export function ArchivedShopScreen({ archivedId }: { archivedId: string }) {
  const archived = useQuery({
    queryKey: [...historyKey, archivedId],
    queryFn: () => fetchArchivedShop(archivedId),
  });
  if (archived.isError) {
    return (
      <>
        <ScreenHeader title="Archived shop" back={back} />
        <EmptyState>{archived.error.message}</EmptyState>
      </>
    );
  }
  if (!archived.data) {
    return <ScreenHeader title="Archived shop" back={back} />;
  }
  const shop = archived.data;
  const planStartDate = shop.planStartDate;
  const dayLabel = (position: number): string =>
    planStartDate
      ? formatDay(dayDate({ startDate: planStartDate }, position))
      : `Day ${position + 1}`;

  return (
    <>
      <ScreenHeader title="Archived shop" back={back} />
      <h2 className="m-0 text-[22px] font-bold">{shop.name}</h2>
      <p className={hint}>Archived {formatTimestampDay(shop.archivedAt)}</p>
      {shop.meals.length > 0 && (
        <>
          <h3 className={sectionLabel}>Meals</h3>
          <ul className={`${listBox} m-0 list-none p-0`}>
            {shop.meals.map((meal) => (
              <li
                key={meal.position}
                className="flex justify-between gap-3 border-line border-t px-3 py-2.5 text-sm first:border-t-0"
              >
                <span className="text-muted">{dayLabel(meal.position)}</span>
                <b className="font-semibold">{meal.name}</b>
              </li>
            ))}
          </ul>
          <CopyMealsButton shopName={shop.name} meals={shop.meals} />
        </>
      )}
      <h3 className={sectionLabel}>Lines</h3>
      <ul className={`${listBox} m-0 list-none p-0`}>
        {shop.lines.map((line, index) => (
          <li
            // Archived lines have no ids; their order never changes.
            // biome-ignore lint/suspicious/noArrayIndexKey: the list is read only
            key={index}
            className={cn(
              "flex items-center gap-3 border-line border-t px-3 py-2 first:border-t-0",
              line.ticked && "text-muted line-through",
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="truncate text-[15px] font-semibold">{line.name}</b>
              <small className="truncate text-xs text-muted">
                {[line.size, line.sources.join(", ")]
                  .filter((part) => part)
                  .join(" · ")}
              </small>
            </span>
            <span className="font-bold tabular-nums">×{line.count}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
