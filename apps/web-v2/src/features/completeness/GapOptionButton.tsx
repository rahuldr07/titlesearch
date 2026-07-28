import type { ReactNode } from "react";
import { Button } from "../../shared/ui/Button";
import { cn } from "../../shared/ui/classNames";

/**
 * One way out of a gap, stated as a headline and its consequence.
 *
 * THE SECOND LINE IS THE POINT. Every option carries what it does to the
 * record, at the moment of choosing, rather than in a confirmation afterwards.
 *
 * CONTRACT GAP: the design ranked the options by tone — tinted for the ones
 * that cost nothing to be wrong about, outlined for the ones that change the
 * record. `close_options` are opaque strings with no kind, so the ranking is
 * not derivable and the tone now marks only which option is being filled in.
 */
const TITLE_INK = {
  action: "text-action-ink",
  settled: "text-state-settled-ink",
  neutral: "text-ink-primary",
} as const;

export function GapOptionButton({
  tone,
  title,
  sub,
  disabled = false,
  onClick,
}: {
  tone: keyof typeof TITLE_INK;
  title: string;
  sub: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      tone={tone}
      fill={tone === "neutral" ? "outlined" : "tinted"}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-w-100 flex-1 flex-col items-start gap-1 rounded-7 px-7 py-6 text-left",
        "border-(length:--stroke-emphasis)",
        // Opacity is this codebase's one signal for "you may not do this" —
        // never a general dimming, so it stays reserved for the role refusal.
        disabled && "opacity-55",
      )}
    >
      <span className={cn("text-base font-semibold", disabled ? "" : TITLE_INK[tone])}>
        {title}
      </span>
      <span className={cn("text-xs font-normal", disabled ? "" : "text-ink-secondary")}>
        {sub}
      </span>
    </Button>
  );
}
