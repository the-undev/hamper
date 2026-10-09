import {
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { isCloseMatch } from "@/lib/distance";
import { Badge } from "./ui/badge";
import { Command, CommandGroup, CommandItem, CommandList } from "./ui/command";
import { Input } from "./ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "./ui/popover";

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

/** How well an option's name matches the typed text: exact, prefix, substring, close, or no match. */
type MatchRank = 0 | 1 | 2 | 3 | 4;

/** The rank of a name that is only within a few edits of the typed text. */
const closeRank: MatchRank = 3;

/** Ranks a name against lower-cased typed text, ignoring case. */
function matchRank(name: string, wanted: string): MatchRank {
  const lowerName = name.toLowerCase();
  if (lowerName === wanted) {
    return 0;
  }
  if (lowerName.startsWith(wanted)) {
    return 1;
  }
  if (lowerName.includes(wanted)) {
    return 2;
  }
  return isCloseMatch(lowerName, wanted) ? closeRank : 4;
}

/** The options matching a query with their ranks, best first. */
function rankedOptions<O extends TypeAheadOption>(
  options: readonly O[],
  query: string,
): { option: O; rank: MatchRank }[] {
  const wanted = query.trim().toLowerCase();
  if (wanted === "") {
    return options.map((option) => ({ option, rank: 0 }));
  }
  return options
    .map((option) => ({ option, rank: matchRank(option.name, wanted) }))
    .filter(({ rank }) => rank < 4)
    .sort((first, second) => first.rank - second.rank);
}

/** Orders the options matching a query: an exact name, then names that start with it, then names that contain it, then names a few edits away, ignoring case. */
export function rankOptions<O extends TypeAheadOption>(
  options: readonly O[],
  query: string,
): O[] {
  return rankedOptions(options, query).map(({ option }) => option);
}

type Row<O> =
  | { kind: "pick"; option: O; close: boolean }
  | { kind: "create"; name: string };

/** The note beside a match: the option's own detail, else a "close match" badge for a name a few edits away. */
function PickDetail({
  option,
  close,
}: {
  option: TypeAheadOption;
  close: boolean;
}) {
  if (option.detail) {
    return (
      <small className="truncate text-xs text-muted">{option.detail}</small>
    );
  }
  return close ? <Badge variant="outline">close match</Badge> : null;
}

/** Whether an option's name is the typed name, ignoring case and surrounding spaces. */
function namesMatch(option: TypeAheadOption, typedName: string): boolean {
  return option.name.trim().toLowerCase() === typedName.toLowerCase();
}

/** The value cmdk holds while no row is highlighted: it matches no row, so cmdk never highlights the first row by itself. */
const noHighlight = "-";

/** The value cmdk knows a row by. */
function rowValue<O extends TypeAheadOption>(row: Row<O>): string {
  return row.kind === "create" ? "create" : `pick:${row.option.id}`;
}

/** The ids cmdk gives the list and the highlighted row, which the input points at. */
interface ListIds {
  list: string | undefined;
  active: string | undefined;
}

/** Reads the ids cmdk gave the list and the highlighted row, and keeps that row in view. */
function ListIdReader({
  listRef,
  highlightValue,
  onRead,
}: {
  listRef: RefObject<HTMLDivElement | null>;
  highlightValue: string;
  onRead: Dispatch<SetStateAction<ListIds>>;
}) {
  useLayoutEffect(() => {
    const list = listRef.current;
    const rowElements = list?.querySelectorAll<HTMLElement>("[cmdk-item]");
    const active = [...(rowElements ?? [])].find(
      (rowElement) => rowElement.dataset.value === highlightValue,
    );
    active?.scrollIntoView({ block: "nearest" });
    const ids = { list: list?.id, active: active?.id };
    onRead((current) =>
      current.list === ids.list && current.active === ids.active
        ? current
        : ids,
    );
  }, [listRef, highlightValue, onRead]);
  return null;
}

/** The one control for adding a line: type, then pick a match or take the create row from the suggestions floating under the box; Enter takes what was typed, or the row the arrows highlight. */
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
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);
  const [listIds, setListIds] = useState<ListIds>({
    list: undefined,
    active: undefined,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typedName = query.trim();

  const rows: Row<O>[] = [];
  const matches = rankedOptions(options, typedName);
  const exactMatch = options.find((option) => namesMatch(option, typedName));
  if (typedName !== "" || listWhenEmpty) {
    const shown = typedName === "" ? matches : matches.slice(0, matchLimit);
    rows.push(
      ...shown.map(({ option, rank }) => ({
        kind: "pick" as const,
        option,
        close: rank === closeRank,
      })),
    );
  }
  if (create && typedName !== "" && !exactMatch) {
    rows.push({ kind: "create", name: typedName });
  }
  const highlightedRow =
    highlightIndex === null ? undefined : rows[highlightIndex];
  const listShown = open && rows.length > 0;
  const highlightValue = highlightedRow
    ? rowValue(highlightedRow)
    : noHighlight;

  const close = (): void => {
    setOpen(false);
    setHighlightIndex(null);
  };

  const changeQuery = (nextQuery: string): void => {
    setQuery(nextQuery);
    setHighlightIndex(null);
  };

  const take = (row: Row<O>): void => {
    changeQuery("");
    setOpen(false);
    if (row.kind === "create") {
      create?.onCreate(row.name);
      return;
    }
    onPick(row.option);
  };

  const takeTyped = (): void => {
    if (exactMatch) {
      take({ kind: "pick", option: exactMatch, close: false });
      return;
    }
    if (create && typedName !== "") {
      take({ kind: "create", name: typedName });
    }
  };

  const moveHighlight = (step: 1 | -1): void => {
    setOpen(true);
    if (rows.length === 0) {
      return;
    }
    if (!listShown || !highlightedRow || highlightIndex === null) {
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
      if (listShown) {
        close();
        return;
      }
      changeQuery("");
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (listShown && highlightedRow) {
      take(highlightedRow);
      return;
    }
    takeTyped();
  };

  return (
    <Popover
      open={listShown}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
    >
      <PopoverAnchor asChild>
        <Input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={listShown}
          aria-controls={listShown ? listIds.list : undefined}
          aria-activedescendant={
            listShown && highlightedRow ? listIds.active : undefined
          }
          placeholder={placeholder}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            changeQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
        />
      </PopoverAnchor>
      <PopoverContent
        // The listbox inside is the popup the input controls; the wrapper adds nothing for a screen reader.
        role="presentation"
        align="start"
        sideOffset={4}
        collisionPadding={8}
        // The sheet the meal picker sits in slides in after the box gains focus; the overlay follows it.
        updatePositionStrategy="always"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (inputRef.current?.contains(event.target as Node)) {
            event.preventDefault();
          }
        }}
        // A press on a row keeps the focus, and a phone's keyboard, in the box.
        onMouseDown={(event) => event.preventDefault()}
        className="w-(--radix-popover-trigger-width) gap-0 overflow-hidden rounded-[14px] border border-line bg-surface p-0 shadow-(--shadow) ring-0"
      >
        {/* A new query starts a new list, so a highlight never outlives the text it was made for. */}
        <Command
          key={query}
          shouldFilter={false}
          disablePointerSelection
          value={highlightValue}
          onValueChange={(value) => {
            const index = rows.findIndex((row) => rowValue(row) === value);
            setHighlightIndex(index === -1 ? null : index);
          }}
        >
          <CommandList
            ref={listRef}
            className="max-h-[min(15.5rem,var(--radix-popover-content-available-height))]"
          >
            <CommandGroup>
              {rows.map((row) => (
                <CommandItem
                  key={rowValue(row)}
                  value={rowValue(row)}
                  onSelect={() => take(row)}
                  className="min-h-11 w-full justify-between gap-3 border-line border-t px-3.5 py-2 text-left text-[15px] first:border-t-0 hover:bg-soft"
                >
                  {row.kind === "create" ? (
                    <span className="font-semibold text-accent">
                      {create?.label(row.name)}
                    </span>
                  ) : (
                    <>
                      <span className="truncate">{row.option.name}</span>{" "}
                      <PickDetail option={row.option} close={row.close} />
                    </>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <ListIdReader
            listRef={listRef}
            highlightValue={highlightValue}
            onRead={setListIds}
          />
        </Command>
      </PopoverContent>
    </Popover>
  );
}
