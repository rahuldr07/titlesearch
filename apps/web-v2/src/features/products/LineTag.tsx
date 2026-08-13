import type { ReactNode } from "react";
import { cn } from "../../shared/ui/classNames";

/**
 * The line card's property tags — answer shape, comment rule, period carriage,
 * machine check.
 *
 * Not `Chip`: a chip in this design is a 9px uppercase STATE badge, and these
 * are sentence-case sentences ("Comment required on NO") that a person reads
 * rather than scans. Forcing them through Chip would mean overriding its case,
 * size, weight and tracking at every call site, which is how a primitive stops
 * meaning anything.
 *
 * The tone is the tag's CLAIM, not its colour. `settled` marks a line something
 * checks mechanically; `attend` marks one only a human ever answers — that
 * difference decides whether a wrong answer can be caught at all, so it is
 * carried by tint and not left to the wording.
 */
const TONES = {
  neutral: "border-line-strong bg-surface-app text-ink-secondary",
  action: "border-action-border bg-action-surface text-action-ink font-semibold",
  settled:
    "border-state-settled-border bg-state-settled-surface text-state-settled-ink",
  attend: "border-state-attend-border bg-state-attend-surface text-state-attend-ink",
} as const;

export function LineTag({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-4 border px-4 py-1 text-tiny leading-close",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
