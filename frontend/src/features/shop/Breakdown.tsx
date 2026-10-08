import { useNavigate } from "@tanstack/react-router";
import { useId } from "react";
import { WaitingForServer } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/ScreenHeader";
import { hint, primaryButton, sectionLabel } from "@/components/styles";
import { dayDate } from "@/domain/display";
import { generateShop } from "@/domain/shops";
import { DayLines } from "@/features/plan/DayLines";
import { WantedLines } from "@/features/plan/WantedLines";
import {
  useDayLinesByDay,
  useItemsById,
  usePlan,
  usePlannedDays,
} from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { formatDay, nowIso } from "@/lib/dates";
import type { Day, DayLine, Item, Plan } from "@/store/types";

const back = { to: "/shop", label: "Cancel" } as const;

/** Everything a list is made from, edited straight into the plan, then Generate. */
export function Breakdown() {
  const plan = usePlan();
  const days = usePlannedDays();
  const linesByDay = useDayLinesByDay();
  const itemsById = useItemsById();
  const write = useWrite();
  const navigate = useNavigate();
  const wantedHeadingId = useId();

  if (plan === null) {
    return (
      <>
        <ScreenHeader title="Breakdown" back={back} />
        <WaitingForServer />
      </>
    );
  }
  if (!plan || !days || !linesByDay || !itemsById) {
    return <ScreenHeader title="Breakdown" back={back} />;
  }

  const plannedDays = [...days.values()]
    .filter((day) => day.position < plan.lengthDays)
    .sort((first, second) => first.position - second.position);

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
      {plannedDays.map((day) => (
        <BreakdownDay
          key={day.id}
          plan={plan}
          day={day}
          lines={linesByDay.get(day.id) ?? []}
          itemsById={itemsById}
        />
      ))}
      <section
        aria-labelledby={wantedHeadingId}
        className="flex flex-col gap-2"
      >
        <h2 id={wantedHeadingId} className={sectionLabel}>
          Wanted
        </h2>
        <WantedLines itemsById={itemsById} typeAheadLabel="Add a wanted item" />
      </section>
      <button
        type="button"
        className={primaryButton}
        onClick={() => void generate()}
      >
        Generate the list
      </button>
    </>
  );
}

function BreakdownDay({
  plan,
  day,
  lines,
  itemsById,
}: {
  plan: Plan;
  day: Day;
  lines: readonly DayLine[];
  itemsById: ReadonlyMap<string, Item>;
}) {
  const headingId = useId();
  const date = formatDay(dayDate(plan, day.position));
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className={sectionLabel}>
        {date}{" "}
        <span className="font-medium normal-case tracking-normal">
          {day.name}
        </span>
      </h2>
      <DayLines
        position={day.position}
        lines={lines}
        itemsById={itemsById}
        typeAheadLabel={`Add an item for ${date}`}
      />
    </section>
  );
}
