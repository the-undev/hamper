/** A full-width call to action in the accent colour. */
export const primaryButton =
  "min-h-11 w-full rounded-[14px] bg-accent px-4 py-3 text-center text-[15px] font-bold text-accent-foreground disabled:opacity-40";

/** An outlined button for the actions beside or under a list. */
export const secondaryButton =
  "min-h-11 flex-1 rounded-[14px] border border-line px-3 py-2.5 text-center text-sm font-semibold disabled:opacity-40";

/** A small uppercase heading over a list. */
export const sectionLabel =
  "flex items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-[.06em] text-muted";

/** Small muted text under or beside a control. */
export const hint = "text-xs text-muted";

/** A text box that fills its row. */
export const textInput =
  "w-full min-h-11 rounded-[14px] border border-line bg-background px-3.5 py-2.5 text-base placeholder:text-muted";

/** The bordered box that holds a list of rows. */
export const listBox =
  "flex flex-col overflow-hidden rounded-[14px] border border-line";

/** The widest the app gets: a centred column that grows with the viewport up to --column-max. */
export const columnWidth = "mx-auto w-full max-w-(--column-max)";
