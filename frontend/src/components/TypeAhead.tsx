import { type KeyboardEvent, useId, useState } from "react";
import { cn } from "@/lib/utils";
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

/** Whether an option's name is the typed name, ignoring case and surrounding spaces. */
function namesMatch(option: TypeAheadOption, typedName: string): boolean {
  return option.name.trim().toLowerCase() === typedName.toLowerCase();
}

/** The one control for adding a line: type, then pick a match or take the create row under them; Enter takes what was typed, or the row the arrows highlight. */
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
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const listId = useId();
  const typedName = query.trim();

  const rows: Row<O>[] = [];
  const matches = rankOptions(options, typedName);
  const exactMatch = options.find((option) => namesMatch(option, typedName));
  if (typedName !== "" || listWhenEmpty) {
    const shown = typedName === "" ? matches : matches.slice(0, matchLimit);
    rows.push(...shown.map((option) => ({ kind: "pick" as const, option })));
  }
  if (create && typedName !== "" && !exactMatch) {
    rows.push({ kind: "create", name: typedName });
  }
  const highlightedRow =
    highlightIndex === null ? undefined : rows[highlightIndex];
  const optionId = (index: number): string => `${listId}-${index}`;

  const changeQuery = (nextQuery: string): void => {
    setQuery(nextQuery);
    setHighlightIndex(null);
  };

  const take = (row: Row<O>): void => {
    changeQuery("");
    if (row.kind === "create") {
      create?.onCreate(row.name);
      return;
    }
    onPick(row.option);
  };

  const takeTyped = (): void => {
    if (exactMatch) {
      take({ kind: "pick", option: exactMatch });
      return;
    }
    if (create && typedName !== "") {
      take({ kind: "create", name: typedName });
    }
  };

  const moveHighlight = (step: 1 | -1): void => {
    if (rows.length === 0) {
      return;
    }
    if (!highlightedRow || highlightIndex === null) {
      setHighlightIndex(step === 1 ? 0 : rows.length - 1);
      return;
    }
    setHighlightIndex((highlightIndex + step + rows.length) % rows.length);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Escape") {
      if (highlightedRow) {
        setHighlightIndex(null);
        return;
      }
      changeQuery("");
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (highlightedRow) {
      take(highlightedRow);
      return;
    }
    takeTyped();
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        aria-label={label}
        aria-controls={rows.length > 0 ? listId : undefined}
        aria-activedescendant={
          highlightedRow && highlightIndex !== null
            ? optionId(highlightIndex)
            : undefined
        }
        placeholder={placeholder}
        autoComplete="off"
        value={query}
        onChange={(event) => changeQuery(event.target.value)}
        onKeyDown={onKeyDown}
        className={textInput}
      />
      {rows.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-sm"
        >
          {rows.map((row, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the input handles the keys for every option
            <div
              key={row.kind === "create" ? "create" : row.option.id}
              id={optionId(index)}
              role="option"
              tabIndex={-1}
              aria-selected={highlightedRow === row}
              onClick={() => take(row)}
              className={cn(
                "flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 border-line border-t px-3.5 py-2 text-left text-[15px] first:border-t-0 hover:bg-soft",
                highlightedRow === row && "bg-soft",
              )}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
