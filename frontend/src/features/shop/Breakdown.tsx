import { useNavigate } from "@tanstack/react-router";
import { useId } from "react";
import { WaitingForServer } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint, sectionLabel } from "@/components/styles";
import { Button } from "@/components/ui/button";
import { dayDate } from "@/domain/display";
import { generateShop } from "@/domain/shops";
import { PlannedMealLines } from "@/features/plan/PlannedMealLines";
import { WantedLines } from "@/features/plan/WantedLines";
import {
  useItemsById,
  usePlan,
  usePlannedMealLinesByPlannedMeal,
  usePlannedMealsByPosition,
} from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, nowIso } from "@/lib/dates";
import type { Item, PlannedMeal, PlannedMealLine } from "@/store/types";

const back = { to: "/shop", label: "Cancel" } as const;

/** Everything a list is made from, day by day and then the extras, edited straight into the plan, then Generate. */
export function Breakdown() {
  const plan = usePlan();
  const mealsByPosition = usePlannedMealsByPosition();
  const linesByPlannedMeal = usePlannedMealLinesByPlannedMeal();
  const itemsById = useItemsById();
  const write = useWrite();
  const navigate = useNavigate();
  const extrasHeadingId = useId();

  if (plan === null) {
    return (
      <>
        <ScreenHeader title="Breakdown" back={back} />
        <WaitingForServer />
      </>
    );
  }
  if (!plan || !mealsByPosition || !linesByPlannedMeal || !itemsById) {
    return <ScreenHeader title="Breakdown" back={back} />;
  }

  const positions = Array.from({ length: plan.lengthDays }, (_, at) => at);

  const generate = async (): Promise<void> => {
    const name = `Shop ${formatDay(plan.startDate)}`;
    const shop = await write((w) => generateShop(w, name, nowIso()));
    if (shop) {
      await navigate({ to: "/shop/$shopId", params: { shopId: shop.id } });
    }
  };

  return (
    <>
      <ScreenHeader title="Breakdown" back={back} />
      <p className={hint}>
        Everything the list will be made from. Changes here are saved to the
        plan.
      </p>
      {positions.map((position) => (
        <BreakdownDay
          key={position}
          date={formatDay(dayDate(plan, position))}
          plannedMeals={mealsByPosition.get(position) ?? []}
          linesByPlannedMeal={linesByPlannedMeal}
          itemsById={itemsById}
        />
      ))}
      <section
        aria-labelledby={extrasHeadingId}
        className="flex flex-col gap-2"
      >
        <h2 id={extrasHeadingId} className={sectionLabel}>
          Extras
        </h2>
        <WantedLines itemsById={itemsById} typeAheadLabel="Add to extras" />
      </section>
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={() => void generate()}
      >
        Generate the list
      </Button>
    </>
  );
}

/** One day of the breakdown: its date, then each of its planned meals with its lines, or "nothing planned". */
function BreakdownDay({
  date,
  plannedMeals,
  linesByPlannedMeal,
  itemsById,
}: {
  date: string;
  plannedMeals: readonly PlannedMeal[];
  linesByPlannedMeal: ReadonlyMap<string, PlannedMealLine[]>;
  itemsById: ReadonlyMap<string, Item>;
}) {
  const dateId = useId();
  return (
    <section aria-labelledby={dateId} className="flex flex-col gap-2">
      <h2 className={sectionLabel}>
        <span id={dateId}>{date}</span>
        {plannedMeals.length > 0 && (
          <span className="font-medium normal-case tracking-normal">
            this day's meal only
          </span>
        )}
      </h2>
      {plannedMeals.length === 0 && <p className={hint}>nothing planned</p>}
      {plannedMeals.map((plannedMeal) => (
        <BreakdownMeal
          key={plannedMeal.id}
          date={date}
          plannedMeal={plannedMeal}
          lines={linesByPlannedMeal.get(plannedMeal.id) ?? []}
          itemsById={itemsById}
        />
      ))}
    </section>
  );
}

/** One planned meal in the breakdown: its name and its lines, edited for it only. */
function BreakdownMeal({
  date,
  plannedMeal,
  lines,
  itemsById,
}: {
  date: string;
  plannedMeal: PlannedMeal;
  lines: readonly PlannedMealLine[];
  itemsById: ReadonlyMap<string, Item>;
}) {
  const nameId = useId();
  return (
    <section aria-labelledby={nameId} className="flex flex-col gap-2">
      <h3 id={nameId} className="m-0 text-[15px] font-semibold">
        {plannedMeal.name}
      </h3>
      <PlannedMealLines
        plannedMealId={plannedMeal.id}
        lines={lines}
        itemsById={itemsById}
        typeAheadLabel={`Add an item for ${plannedMeal.name} on ${date}`}
      />
    </section>
  );
}
