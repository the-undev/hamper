import { type KeyboardEvent, useState } from "react";
import { textInput } from "./styles";

/** Something the type-ahead can offer: a name, and small text beside it. */
export interface TypeAheadOption {
  id: string;
  name: string;
  detail: string | null;
}

/** How the type-ahead makes something new from a name matching nothing. */
export interface TypeAheadCreate {
  label: (name: string) => string;
  onCreate: (name: string) => void;
}

const matchLimit = 6;

/** Orders the options matching a query: an exact name, then names that start with it, then names that contain it, ignoring case. */
export function rankOptions<O extends TypeAheadOption>(
  options: readonly O[],
  query: string,
): O[] {
  const wanted = query.trim().toLowerCase();
  if (wanted === "") {
    return [...options];
  }
  const rankOf = (option: O): number => {
    const name = option.name.toLowerCase();
    if (name === wanted) {
      return 0;
    }
    if (name.startsWith(wanted)) {
      return 1;
    }
    return name.includes(wanted) ? 2 : 3;
  };
  return options
    .map((option) => ({ option, rank: rankOf(option) }))
    .filter(({ rank }) => rank < 3)
    .sort((first, second) => first.rank - second.rank)
    .map(({ option }) => option);
}

type Row<O> = { kind: "pick"; option: O } | { kind: "create"; name: string };

/** The one control for adding a line: type, then pick a match or take the create row under them; Enter takes the first row, the best match when there is one. */
export function TypeAhead<O extends TypeAheadOption>({
  label,
  placeholder,
  options,
  onPick,
  create,
  listWhenEmpty = false,
}: {
  label: string;
  placeholder: string;
  options: readonly O[];
  onPick: (option: O) => void;
  create?: TypeAheadCreate;
  /** Lists every option while nothing is typed, as the meal picker does. */
  listWhenEmpty?: boolean;
}) {
  const [query, setQuery] = useState("");
  const typedName = query.trim();

  const rows: Row<O>[] = [];
  const matches = rankOptions(options, typedName);
  const exactMatch = matches.some(
    (option) => option.name.toLowerCase() === typedName.toLowerCase(),
  );
  if (typedName !== "" || listWhenEmpty) {
    const shown = typedName === "" ? matches : matches.slice(0, matchLimit);
    rows.push(...shown.map((option) => ({ kind: "pick" as const, option })));
  }
  if (create && typedName !== "" && !exactMatch) {
    rows.push({ kind: "create", name: typedName });
  }

  const take = (row: Row<O>): void => {
    setQuery("");
    if (row.kind === "create") {
      create?.onCreate(row.name);
      return;
    }
    onPick(row.option);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      setQuery("");
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const firstRow = rows[0];
    if (firstRow && typedName !== "") {
      take(firstRow);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        className={textInput}
      />
      {rows.length > 0 && (
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[14px] border border-line bg-surface p-0 shadow-sm">
          {rows.map((row) => (
            <li
              key={row.kind === "create" ? "create" : row.option.id}
              className="border-line border-t first:border-t-0"
            >
              <button
                type="button"
                onClick={() => take(row)}
                className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[15px] hover:bg-soft"
              >
                {row.kind === "create" ? (
                  <span className="font-semibold text-accent">
                    {create?.label(row.name)}
                  </span>
                ) : (
                  <>
                    <span className="truncate">{row.option.name}</span>{" "}
                    {row.option.detail && (
                      <small className="truncate text-xs text-muted">
                        {row.option.detail}
                      </small>
                    )}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
