import type { ReactNode } from "react";
import { Button } from "../../shared/ui/Button";
import { cn } from "../../shared/ui/classNames";

/**
 * One way out of a gap, stated as a headline and its consequence.
 *
 * THE SECOND LINE IS THE POINT. Every option carries what it does to the
 * record, at the moment of choosing, rather than in a confirmation afterwards.
 *
 * The design ranks the options by tone — tinted for the ones that cost nothing
 * to be wrong about, outlined for the ones that change the record. Since
 * 2026-07-30 the wire carries each option's kind, whether it requires a
 * comment and the role it requires, so the ranking is the server's fact rather
 * than a guess from the copy. `GapCloseOptions` owns the mapping; this
 * component draws whatever tone it is handed.
 *
 * `expanded` IS ANNOUNCED, NOT DRAWN. Choosing an option opens the closure form
 * beneath the row rather than restyling the button, so the state a screen
 * reader needs is the state the visual arrangement already shows.
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
  expanded,
  onClick,
}: {
  tone: keyof typeof TITLE_INK;
  title: string;
  sub: ReactNode;
  disabled?: boolean;
  /** True while this option's closure form is open beneath the row. */
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      tone={tone}
      fill={tone === "neutral" ? "outlined" : "tinted"}
      disabled={disabled}
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        // `whitespace-normal` UNDOES `Button`'s `whitespace-nowrap`, which is
        // right for a one-line control and wrong for this one. RULE: the
        // consequence line is the point of this button and must be readable at
        // whatever width the row gives it. FAILURE PREVENTED: on the three-option
        // gap ("Deed chain complete") the options divide the card into 223px
        // columns, and nowrap ran "The client paid for this product. Senior/ops
        // only…" straight out of the card, where `Card`'s `overflow-hidden`
        // clipped it mid-sentence — the one option with money attached, silently
        // truncated.
        "whitespace-normal",
        // 300px, not 200. RULE: the option keeps the two-up rhythm the rest of
        // the screen is drawn in. FAILURE PREVENTED: `--spacing` is 2px, so the
        // old `min-w-100` reads 200px and let THREE options share one 688px row
        // at 223px each — narrower than the 339px every two-option card gets,
        // and the only place in the screen where the same control changes size.
        // At 300px the third wraps to its own full-width row instead.
        "min-w-150 flex-1 flex-col items-start gap-1 rounded-7 px-7 py-6 text-left",
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
