import { hint, sectionLabel } from "@/components/styles";
import { useItemsById } from "@/hooks/data";
import { WantedLines } from "./WantedLines";

/** The extras list: things beyond what the days need, each Once or Weekly. */
export function PlanItems() {
  const itemsById = useItemsById();
  return (
    <>
      <h2 className={sectionLabel}>
        Extras{" "}
        <span className="font-medium normal-case tracking-normal">
          beyond what the meals need
        </span>
      </h2>
      {itemsById && (
        <WantedLines itemsById={itemsById} typeAheadLabel="Add to extras" />
      )}
      <p className={hint}>
        Weekly stays when a new plan starts. Once is cleared by it.
      </p>
    </>
  );
}
