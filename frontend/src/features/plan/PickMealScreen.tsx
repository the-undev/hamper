import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { WaitingForServer } from "@/components/EmptyState";
import { Picture } from "@/components/Picture";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint, listBox, sectionLabel } from "@/components/styles";
import { rankOptions } from "@/components/TypeAhead";
import { Input } from "@/components/ui/input";
import { dayDate } from "@/domain/display";
import { placeAdHoc, placeMeal } from "@/domain/plan";
import {
  lineNames,
  useItemsById,
  useLiveMeals,
  useMealLinesByMeal,
  usePlan,
} from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, nowIso } from "@/lib/dates";

/** The screen the picker was opened from, which it goes back to. */
export type PickOpener = "plan" | "day";

/** A library meal as the picker lists it: its name, its lines as text and its picture. */
interface MealRow {
  id: string;
  name: string;
  detail: string | null;
  imageId: string | null;
}

const rowClasses =
  "flex min-h-11 w-full items-center gap-3 border-line border-t px-3 py-1.5 text-left first:border-t-0 hover:bg-soft";

/** One library meal as a row: its picture, its name and its lines in small text. */
function MealRowButton({
  row,
  onPick,
}: {
  row: MealRow;
  onPick: (row: MealRow) => void;
}) {
  return (
    <li>
      <button type="button" className={rowClasses} onClick={() => onPick(row)}>
        <Picture name={row.name} imageId={row.imageId} size="row" />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="truncate text-[15px] font-semibold">{row.name}</b>
          {row.detail && (
            <small className="truncate text-xs text-muted">{row.detail}</small>
          )}
        </span>
      </button>
    </li>
  );
}

/** Picking a meal for one day: the box at the top, the library under it, and a typed name for a day of its own. */
export function PickMealScreen({
  position,
  opener,
}: {
  position: number;
  opener: PickOpener;
}) {
  const plan = usePlan();
  const meals = useLiveMeals();
  const linesByMeal = useMealLinesByMeal();
  const itemsById = useItemsById();
  const write = useWrite();
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const libraryHeadingId = useId();
  const ownHeadingId = useId();

  const waiting = plan === null;
  useEffect(() => {
    if (!waiting) {
      inputRef.current?.focus();
    }
  }, [waiting]);

  const back = { to: "/plan", label: "Plan" } as const;
  if (waiting) {
    return (
      <>
        <ScreenHeader title="Pick a meal" back={back} />
        <WaitingForServer />
      </>
    );
  }

  const title = plan
    ? `Pick a meal for ${formatDay(dayDate(plan, position))}`
    : "Pick a meal";
  const params = { position: String(position) };
  const typedName = query.trim();
  const rows: MealRow[] = (meals ?? []).map((meal) => ({
    id: meal.id,
    name: meal.name,
    detail:
      lineNames(linesByMeal?.get(meal.id) ?? [], itemsById ?? new Map()) ||
      null,
    imageId: meal.imageId,
  }));
  const shownRows = rankOptions(rows, typedName);
  const exactRow = rows.find(
    (row) => row.name.trim().toLowerCase() === typedName.toLowerCase(),
  );
  const offerOwnDay = typedName !== "" && !exactRow;

  const backToOpener = (): void => {
    if (canGoBack) {
      router.history.back();
      return;
    }
    void navigate(
      opener === "day"
        ? { to: "/plan/day/$position", params }
        : { to: "/plan" },
    );
  };

  const pickMeal = async (row: MealRow): Promise<void> => {
    const placed = await write(async (w) => {
      await placeMeal(w, position, row.id, nowIso());
      return true;
    });
    if (placed) {
      backToOpener();
    }
  };

  const placeAsItIs = async (name: string): Promise<void> => {
    const placed = await write(async (w) => {
      await placeAdHoc(w, position, name, nowIso());
      return true;
    });
    if (!placed) {
      return;
    }
    if (opener === "day") {
      backToOpener();
      return;
    }
    // A day of its own has no lines yet, so it opens in place of the picker.
    void navigate({ to: "/plan/day/$position", params, replace: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (exactRow) {
      void pickMeal(exactRow);
      return;
    }
    if (typedName !== "") {
      void placeAsItIs(typedName);
    }
  };

  return (
    <>
      <ScreenHeader title={title} back={back} />
      <Input
        ref={inputRef}
        type="text"
        aria-label="Meal"
        placeholder="A meal, or anything: Takeaway, Leftovers…"
        autoComplete="off"
        enterKeyHint="go"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {(typedName === "" || shownRows.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 id={libraryHeadingId} className={sectionLabel}>
            Library
          </h2>
          {meals && rows.length === 0 && (
            <p className={hint}>No meals in the library yet.</p>
          )}
          {shownRows.length > 0 && (
            <ul aria-labelledby={libraryHeadingId} className={listBox}>
              {shownRows.map((row) => (
                <MealRowButton
                  key={row.id}
                  row={row}
                  onPick={(picked) => void pickMeal(picked)}
                />
              ))}
            </ul>
          )}
        </section>
      )}
      {offerOwnDay && (
        <section className="flex flex-col gap-2">
          <h2 id={ownHeadingId} className={sectionLabel}>
            Or a day of its own
          </h2>
          <ul aria-labelledby={ownHeadingId} className={listBox}>
            <li>
              <button
                type="button"
                className={`${rowClasses} text-[15px] font-semibold text-accent`}
                onClick={() => void placeAsItIs(typedName)}
              >
                Use “{typedName}” as it is
              </button>
            </li>
          </ul>
        </section>
      )}
    </>
  );
}
