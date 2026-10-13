/** How the Meals screen shows the library: as rows or as a grid of small cards. */
export type MealsView = "list" | "small";

/** The per-phone setting that keeps the chosen view. */
export const mealsViewSetting = "mealsView";

const mealsViews: readonly MealsView[] = ["list", "small"];

/** The view a stored value names, or the small grid for anything else. */
export function parseMealsView(stored: string | null): MealsView {
  return mealsViews.find((view) => view === stored) ?? "small";
}
