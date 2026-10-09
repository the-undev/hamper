import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchHistory, historyKey } from "@/api/rest";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { formatTimestampDay } from "@/lib/dates";
import { CopyMealsButton } from "./CopyMealsButton";

const back = { to: "/more", label: "More" } as const;

/** Archived shops, newest first, each with its meals and a count of lines. */
export function HistoryScreen() {
  const history = useQuery({ queryKey: historyKey, queryFn: fetchHistory });
  return (
    <>
      <ScreenHeader title="History" back={back} />
      {history.isError && (
        <EmptyState>History needs a connection to the server.</EmptyState>
      )}
      {history.isPending && <EmptyState>Loading history…</EmptyState>}
      {history.data?.length === 0 && (
        <EmptyState>Nothing archived yet.</EmptyState>
      )}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {history.data?.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col gap-1.5 rounded-[14px] border border-line p-3"
          >
            <Link
              to="/more/history/$archivedId"
              params={{ archivedId: entry.id }}
              className="flex min-h-11 flex-col justify-center"
            >
              <b className="text-[15px]">
                {formatTimestampDay(entry.archivedAt)}
              </b>{" "}
              <small className="text-xs text-muted">
                {entry.name} · {entry.lineCount} lines
                {entry.meals.length > 0 &&
                  ` · ${entry.meals.map((meal) => meal.name).join(", ")}`}
              </small>
            </Link>
            <CopyMealsButton shopName={entry.name} meals={entry.meals} />
          </li>
        ))}
      </ul>
    </>
  );
}
