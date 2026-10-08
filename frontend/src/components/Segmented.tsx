import { useId } from "react";
import { cn } from "@/lib/utils";

/** One choice of a segmented control. */
export interface Segment<V extends string> {
  value: V;
  label: string;
}

/** A row of mutually exclusive choices, one of them selected; radio buttons underneath. */
export function Segmented<V extends string>({
  label,
  segments,
  value,
  onChange,
}: {
  label: string;
  segments: readonly Segment<V>[];
  value: V;
  onChange: (value: V) => void;
}) {
  const groupName = useId();
  return (
    <fieldset className="m-0 flex min-w-0 rounded-xl border-0 bg-background p-[3px]">
      <legend className="sr-only">{label}</legend>
      {segments.map((segment) => (
        <label
          key={segment.value}
          className={cn(
            "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] px-2 text-sm font-semibold text-muted has-focus-visible:outline-2 has-focus-visible:outline-accent",
            segment.value === value &&
              "bg-surface text-foreground shadow-[0_1px_3px_rgba(0,0,0,.12)]",
          )}
        >
          <input
            type="radio"
            name={groupName}
            value={segment.value}
            checked={segment.value === value}
            onChange={() => onChange(segment.value)}
            className="sr-only"
          />
          {segment.label}
        </label>
      ))}
    </fieldset>
  );
}
