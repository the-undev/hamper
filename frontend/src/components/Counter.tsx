/** − count +, each button a 44px target, held between a minimum and an optional maximum; a tap reports one step, not the count it makes. */
export function Counter({
  count,
  onAdjust,
  subject,
  min = 1,
  max = Number.POSITIVE_INFINITY,
  format = String,
}: {
  count: number;
  onAdjust: (step: 1 | -1) => void;
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
        onClick={() => onAdjust(-1)}
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
        onClick={() => onAdjust(1)}
        className="grid size-11 place-items-center rounded-[10px] text-lg font-semibold text-accent hover:bg-soft disabled:opacity-30"
      >
        +
      </button>
    </span>
  );
}
