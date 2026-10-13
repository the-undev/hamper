import { Link, useNavigate } from "@tanstack/react-router";
import { Grid3x3, List } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Picture } from "@/components/Picture";
import { ScreenHeader } from "@/components/ScreenHeader";
import { listBox } from "@/components/styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMeal } from "@/domain/meals";
import { useLiveMeals, useMealLinesByMeal } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";
import { type MealsView, parseMealsView } from "./mealsView";
import { useMealsView } from "./useMealsView";

const viewChoices = [
  { view: "list", label: "List", Icon: List },
  { view: "small", label: "Small grid", Icon: Grid3x3 },
] as const;

/** The icon buttons that choose how the library shows, the chosen one in the accent colour. */
function MealsViewChoice({
  view,
  onChoose,
}: {
  view: MealsView;
  onChoose: (view: MealsView) => void;
}) {
  return (
    <RadioGroup.Root
      aria-label="Show meals as"
      orientation="horizontal"
      value={view}
      onValueChange={(value) => onChoose(parseMealsView(value))}
      className="flex self-end"
    >
      {viewChoices.map(({ view: choice, label, Icon }) => (
        <RadioGroup.Item
          key={choice}
          value={choice}
          aria-label={label}
          className="grid size-11 place-items-center rounded-[10px] text-muted hover:bg-soft data-[state=checked]:text-accent"
        >
          <Icon aria-hidden="true" className="size-5" />
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

/** The library: a search that can add a meal, then the meals as rows or as a grid of cards. */
export function MealsScreen() {
  const meals = useLiveMeals();
  const linesByMeal = useMealLinesByMeal();
  const write = useWrite();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [view, setView] = useMealsView();

  if (!meals || !linesByMeal) {
    return <ScreenHeader title="Meals" />;
  }

  const typedName = query.trim();
  const wanted = typedName.toLowerCase();
  const shownMeals = meals.filter((meal) =>
    meal.name.toLowerCase().includes(wanted),
  );
  const exactMeal = meals.find((meal) => meal.name.toLowerCase() === wanted);

  const addMeal = async (): Promise<void> => {
    const meal = await write((w) => createMeal(w, typedName));
    if (meal) {
      await navigate({ to: "/meals/$mealId", params: { mealId: meal.id } });
    }
  };

  return (
    <>
      <ScreenHeader title="Meals" />
      <Input
        type="search"
        aria-label="Search or add a meal"
        placeholder="Search or add a meal…"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || typedName === "") {
            return;
          }
          if (exactMeal) {
            void navigate({
              to: "/meals/$mealId",
              params: { mealId: exactMeal.id },
            });
            return;
          }
          void addMeal();
        }}
      />
      {typedName !== "" && !exactMeal && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => void addMeal()}
        >
          Add “{typedName}” as a new meal
        </Button>
      )}
      {meals.length === 0 && (
        <EmptyState>No meals yet. Type a name above to add one.</EmptyState>
      )}
      <MealsViewChoice view={view} onChoose={setView} />
      {view === "list" ? (
        <ul className={listBox}>
          {shownMeals.map((meal) => (
            <li key={meal.id}>
              <Link
                to="/meals/$mealId"
                params={{ mealId: meal.id }}
                className="flex min-h-11 w-full items-center gap-3 border-line border-t px-3 py-1.5 first:border-t-0 hover:bg-soft"
              >
                <Picture name={meal.name} imageId={meal.imageId} size="row" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-[15px] font-semibold">
                    {meal.name}
                  </b>
                  <small className="text-xs text-muted">
                    {linesByMeal.get(meal.id)?.length ?? 0} items
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5 p-0">
          {shownMeals.map((meal) => (
            <li key={meal.id}>
              <Link
                to="/meals/$mealId"
                params={{ mealId: meal.id }}
                className="flex h-full flex-col overflow-hidden rounded-[14px] border border-line"
              >
                <Picture name={meal.name} imageId={meal.imageId} size="card" />
                <span className="px-2 py-1.5 text-sm font-semibold wrap-break-word">
                  {meal.name}
                  <small className="block text-xs font-normal text-muted">
                    {linesByMeal.get(meal.id)?.length ?? 0} items
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
