/** Columns every synced row carries: a client-made id, the server's revision, and the tombstone. */
export interface SyncedRow {
  id: string;
  /** The revision the server gave the row's last write; 0 until the server has seen it. */
  revision: number;
  deletedAt: string | null;
}

/** A thing bought, with an optional usual size as free text. */
export interface Item extends SyncedRow {
  name: string;
  size: string | null;
  /** The server's image of it, or null when it has none. */
  imageId: string | null;
}

/** A library meal: a name and its lines. */
export interface Meal extends SyncedRow {
  name: string;
  /** The server's image of it, or null when it has none. */
  imageId: string | null;
}

/** An item and a count on a library meal. */
export interface MealLine extends SyncedRow {
  mealId: string;
  itemId: string;
  count: number;
}

/** The one plan: a start date as yyyy-MM-dd and a length in days. */
export interface Plan extends SyncedRow {
  startDate: string;
  lengthDays: number;
}

/** A day of the plan by position, holding a planned meal's name and an optional link to a library meal. */
export interface Day extends SyncedRow {
  position: number;
  name: string;
  mealId: string | null;
}

/** An item and a count on a day of the plan. */
export interface DayLine extends SyncedRow {
  dayId: string;
  itemId: string;
  count: number;
}

/** An item and a count on the plan's extras list, Once or Weekly. */
export interface WantedLine extends SyncedRow {
  itemId: string;
  count: number;
  weekly: boolean;
}

/** A planned meal as it stood when a shop was made from the plan. */
export interface ShopMeal {
  position: number;
  name: string;
  mealId: string | null;
}

/** An open shopping list, made from the plan or started empty. */
export interface Shop extends SyncedRow {
  name: string;
  createdAt: string;
  fromPlan: boolean;
  planStartDate: string | null;
  planLengthDays: number | null;
  meals: ShopMeal[];
}

/** One item on a shop, with optional text that overrides the item's name and size. */
export interface ShopLine extends SyncedRow {
  shopId: string;
  itemId: string;
  count: number;
  nameOverride: string | null;
  sizeOverride: string | null;
  sources: string[];
  ticked: boolean;
  createdAt: string;
}

/** Every synced table's row type under its wire name. */
export interface TableRows {
  items: Item;
  meals: Meal;
  mealLines: MealLine;
  plan: Plan;
  days: Day;
  dayLines: DayLine;
  wantedLines: WantedLine;
  shops: Shop;
  shopLines: ShopLine;
}

/** A synced table's wire name. */
export type SyncTable = keyof TableRows;

/** The synced tables in the order the server lists them. */
export const syncTables: readonly SyncTable[] = [
  "items",
  "meals",
  "mealLines",
  "plan",
  "days",
  "dayLines",
  "wantedLines",
  "shops",
  "shopLines",
];

/** Rows of every synced table, keyed by wire name. */
export type TableRowLists = { [T in SyncTable]: TableRows[T][] };
