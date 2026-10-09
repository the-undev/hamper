import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Picture } from "@/components/Picture";
import { ScreenHeader } from "@/components/ScreenHeader";
import { secondaryButton, textInput } from "@/components/styles";
import { createMeal } from "@/domain/meals";
import { useLiveMeals, useMealLinesByMeal } from "@/hooks/data";
import { useWrite } from "@/hooks/useWrite";

/** The library: a search that can add a meal, and the meals as a grid of cards. */
export function MealsScreen() {
  const meals = useLiveMeals();
  const linesByMeal = useMealLinesByMeal();
  const write = useWrite();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

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
      <input
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
        className={textInput}
      />
      {typedName !== "" && !exactMeal && (
        <button
          type="button"
          className={secondaryButton}
          onClick={() => void addMeal()}
        >
          Add “{typedName}” as a new meal
        </button>
      )}
      {meals.length === 0 && (
        <EmptyState>No meals yet. Type a name above to add one.</EmptyState>
      )}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 p-0">
        {shownMeals.map((meal) => (
          <li key={meal.id}>
            <Link
              to="/meals/$mealId"
              params={{ mealId: meal.id }}
              className="flex h-full flex-col overflow-hidden rounded-[14px] border border-line"
            >
              <Picture name={meal.name} imageId={meal.imageId} size="card" />
              <span className="px-2.5 py-2 text-sm font-semibold">
                {meal.name}
                <small className="block text-xs font-normal text-muted">
                  {linesByMeal.get(meal.id)?.length ?? 0} items
                </small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
