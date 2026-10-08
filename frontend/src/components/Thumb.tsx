import { cn } from "@/lib/utils";

const placeholderColours = [
  "#8c6a4a",
  "#4a6f8c",
  "#8c4a5c",
  "#5c8c4a",
  "#8c7f4a",
  "#4a8c7f",
  "#6f4a8c",
];

/** Picks a placeholder colour from a name, the same one every time. */
export function colourFor(name: string): string {
  let total = 0;
  for (const character of name) {
    total += character.codePointAt(0) ?? 0;
  }
  return placeholderColours[total % placeholderColours.length] ?? "#8c6a4a";
}

/** The box each picture size fills, shared by the placeholder and the image. */
export const pictureSizes = {
  row: "size-11 rounded-[10px] text-base",
  card: "h-21 w-full text-3xl",
  hero: "h-38 w-full rounded-2xl text-5xl",
} as const;

/** Where a picture shows: a list row, a meal card, or the top of the meal screen. */
export type PictureSize = keyof typeof pictureSizes;

/** The placeholder picture for a meal or item: a coloured block with the name's first letter. */
export function Thumb({ name, size }: { name: string; size: PictureSize }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid flex-none place-items-center font-bold text-white",
        pictureSizes[size],
      )}
      style={{ background: colourFor(name) }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
