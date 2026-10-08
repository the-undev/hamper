import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { listBox, textInput } from "@/components/styles";
import { useLiveItems } from "@/hooks/data";

/** Every live item with its usual size, filtered by a search. */
export function ItemsScreen() {
  const items = useLiveItems();
  const [query, setQuery] = useState("");
  const back = { to: "/more", label: "More" } as const;
  if (!items) {
    return <ScreenHeader title="Items" back={back} />;
  }
  const wanted = query.trim().toLowerCase();
  const shownItems = items.filter((item) =>
    item.name.toLowerCase().includes(wanted),
  );
  return (
    <>
      <ScreenHeader title="Items" back={back} />
      <input
        type="search"
        aria-label="Find an item"
        placeholder="Find an item…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={textInput}
      />
      {shownItems.length === 0 ? (
        <EmptyState>
          {items.length === 0
            ? "No items yet. They arrive as names are typed."
            : "No item has that name."}
        </EmptyState>
      ) : (
        <ul className={`${listBox} m-0 list-none p-0`}>
          {shownItems.map((item) => (
            <li key={item.id} className="border-line border-t first:border-t-0">
              <Link
                to="/more/items/$itemId"
                params={{ itemId: item.id }}
                className="flex min-h-12 flex-col justify-center px-3 py-2 hover:bg-soft"
              >
                <b className="truncate text-[15px] font-semibold">
                  {item.name}
                </b>
                <small className="truncate text-xs text-muted">
                  {item.size ?? "no usual size"}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
