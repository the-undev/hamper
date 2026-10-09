import { useQuery } from "@tanstack/react-query";
import { fetchHistory, historyKey } from "@/api/rest";

/** When the meal was last shopped for: the newest archived shop holding it on a day; undefined while loading or offline, null when never. */
export function useLastShopped(mealId: string): string | null | undefined {
  const history = useQuery({ queryKey: historyKey, queryFn: fetchHistory });
  if (!history.data) {
    return undefined;
  }
  const lastShop = history.data.find((entry) =>
    entry.meals.some((meal) => meal.mealId === mealId),
  );
  return lastShop?.archivedAt ?? null;
}
