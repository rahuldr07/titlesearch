import type { ReactNode } from "react";

/**
 * The small uppercase label this design uses everywhere for state, origin and
 * category. One component so the four state meanings cannot drift into five
 * slightly-different amber chips across screens.
 *
 * `tone` is the SEMANTIC, not the colour:
 *   settled — done, no action needed
 *   decide  — a person must choose; this is yours
 *   attend  — look at this
 *   halt    — stopped, actionable
 *   neutral — a machine/automated label, no attention value
 *   quiet   — correct and expected; recedes
 */
export type ChipTone =
  | "settled"
  | "decide"
  | "attend"
  | "halt"
  | "neutral"
  | "quiet";

const TONE: Record<ChipTone, string> = {
  settled:
    "border-state-settled-border bg-state-settled-surface text-state-settled",
  decide:
    "border-state-decide-border bg-state-decide-surface text-page-ref-ink",
  attend:
    "border-state-attend-border bg-state-attend-surface text-state-attend-ink",
  halt: "border-state-halt-border bg-state-halt-surface text-state-halt-ink",
  neutral: "border-line-strong bg-chip-neutral-surface text-ink-secondary",
  quiet: "border-line-strong bg-transparent text-ink-secondary",
};

export function Chip({
  tone = "neutral",
  testId,
  children,
}: {
  tone?: ChipTone;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <span
      {...(testId === undefined ? {} : { "data-testid": testId })}
      className={`inline-block rounded-xs border px-2 py-px text-micro font-bold tracking-badge uppercase ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}
