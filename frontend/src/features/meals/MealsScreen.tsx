import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Grid2x2, Grid3x3, List, type LucideIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
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

/** The icon that stands for each view. */
const viewIcons = {
  list: List,
  small: Grid3x3,
  large: Grid2x2,
} satisfies Record<MealsView, LucideIcon>;

/** The views in the order the menu lists them. */
const viewChoices = [
  { view: "list", label: "List" },
  { view: "small", label: "Small grid" },
  { view: "large", label: "Large grid" },
] as const satisfies readonly { view: MealsView; label: string }[];

/** Each grid's columns: three cards across a phone for the small grid, two for the large. */
const gridColumns = {
  small: "grid-cols-[repeat(auto-fill,minmax(96px,1fr))]",
  large: "grid-cols-[repeat(auto-fill,minmax(150px,1fr))]",
} as const;

/** The header button showing the current view's icon, opening a menu of the three views. */
function MealsViewMenu({
  view,
  onChoose,
}: {
  view: MealsView;
  onChoose: (view: MealsView) => void;
}) {
  const CurrentIcon = viewIcons[view];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label="Show meals as"
        data-view={view}
        className="grid size-11 place-items-center rounded-[10px] text-muted hover:bg-soft"
      >
        <CurrentIcon aria-hidden="true" className="size-5" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-40 rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden"
        >
          <DropdownMenu.RadioGroup
            value={view}
            onValueChange={(value) => onChoose(parseMealsView(value))}
          >
            {viewChoices.map(({ view: choice, label }) => {
              const Icon = viewIcons[choice];
              return (
                <DropdownMenu.RadioItem
                  key={choice}
                  value={choice}
                  className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2.5 outline-hidden data-highlighted:bg-soft data-[state=checked]:font-semibold data-[state=checked]:text-accent"
                >
                  <Icon aria-hidden="true" className="size-5" />
                  <span className="flex-1">{label}</span>
                  <DropdownMenu.ItemIndicator>
                    <Check aria-hidden="true" className="size-4" />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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
      <ScreenHeader
        title="Meals"
        actions={<MealsViewMenu view={view} onChoose={setView} />}
      />
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
        <ul className={`m-0 grid list-none gap-2.5 p-0 ${gridColumns[view]}`}>
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
