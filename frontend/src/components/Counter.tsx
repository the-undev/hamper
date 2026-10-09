/** − count +, each button a 44px target, held between a minimum and an optional maximum. */
export function Counter({
  count,
  onChange,
  subject,
  min = 1,
  max = Number.POSITIVE_INFINITY,
  format = String,
}: {
  count: number;
  onChange: (count: number) => void;
  /** What is being counted, for the buttons' names: "One more <subject>". */
  subject: string;
  min?: number;
  max?: number;
  format?: (count: number) => string;
}) {
  return (
    <span className="flex flex-none items-center rounded-[10px] bg-background">
      <button
        type="button"
        aria-label={`One fewer ${subject}`}
        disabled={count <= min}
        onClick={() => onChange(count - 1)}
        className="grid size-11 place-items-center rounded-[10px] text-lg font-semibold text-accent hover:bg-soft disabled:opacity-30"
      >
        −
      </button>
      <span
        aria-live="polite"
        className="min-w-6 text-center font-bold tabular-nums"
      >
        {format(count)}
      </span>
      <button
        type="button"
        aria-label={`One more ${subject}`}
        disabled={count >= max}
        onClick={() => onChange(count + 1)}
        className="grid size-11 place-items-center rounded-[10px] text-lg font-semibold text-accent hover:bg-soft disabled:opacity-30"
      >
        +
      </button>
    </span>
  );
}
