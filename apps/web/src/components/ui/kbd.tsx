import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * PORTED FROM apps/web-v2's `Kbd.tsx` — the registry has NO equivalent. shadcn
 * ships `kbd` in some distributions but not in the Aria base this app was
 * initialised from, and the design needs one immediately: the button recipe
 * says hotkey hints render inline at .5–.6 opacity ("Confirm C") and the
 * command surface is chord-driven.
 *
 * Ported rather than rewritten because the old file's reasoning is still exactly
 * right, and it is three rules stacked:
 *
 *   - Rule 3 names kbd explicitly as one of the five things mono is for (refs,
 *     money, citations, hashes, timestamps, kbd), so this is mono BY
 *     CONSTRUCTION rather than by opt-in.
 *   - Rule 5 gives it `--radius-xs`, whose comment in the token file reads
 *     simply "kbd": a key cap is the innermost object in the ladder.
 *   - Rule 4 wants sentence case, and a chord is not a sentence. The design's
 *     vocabulary is `C` `E` `Q` `J/K` `Z` `⌘K` `?` `/` — key NAMES, passed
 *     through as written. This component does not transform case, which is what
 *     keeps `Esc` from becoming `ESC`.
 *
 * `min-w-10` (20px) is there so `C` and `⌘K` sit on the same baseline grid
 * without the single-character cap collapsing to a sliver.
 *
 * ONE CHANGE FROM THE PORT: `muted`. A hotkey hint printed INSIDE a button
 * ("Confirm C") is a hint, not a chip — it takes the button's own ink at
 * reduced weight rather than drawing a second bordered object inside a control.
 * The old kit had callers hand-rolling that; here it is a variant so the two
 * cases cannot drift apart.
 */
export function Kbd({
  children,
  muted,
  className,
}: {
  readonly children: ReactNode;
  /** Inline inside a button label, per the button recipe. No box. */
  readonly muted?: boolean | undefined;
  readonly className?: string | undefined;
}) {
  if (muted === true) {
    return (
      <kbd
        data-slot="kbd"
        data-muted="true"
        className={cx("font-mono text-label leading-flat opacity-60", className)}
      >
        {children}
      </kbd>
    );
  }

  return (
    <kbd
      data-slot="kbd"
      className={cx(
        "inline-flex min-w-10 items-center justify-center rounded-xs border px-3 py-1",
        "border-line-strong bg-surface-sunken",
        "font-mono text-label leading-flat text-ink-secondary",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
