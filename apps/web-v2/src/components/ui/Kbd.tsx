import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * A KEY CAP. Rule 3 names kbd explicitly as one of the five things mono is
 * for — refs, money, citations, hashes, timestamps, kbd — so this is one of the
 * few components in the kit that is mono by construction rather than by opt-in.
 *
 * Rule 5 gives it the 4px radius (`--radius-xs`, whose comment in the token
 * file reads simply "kbd"): a key cap is the innermost object in the ladder.
 *
 * Rule 4 wants sentence case, and a single letter chord is not a sentence — the
 * design's own vocabulary is `C` `E` `Q` `J/K` `Z` `⌘K` `?` `/` and those are
 * key NAMES, not words. They are passed in as written; this component does not
 * transform case, which is what keeps `Esc` from becoming `ESC`.
 */
export function Kbd({ children }: { readonly children: ReactNode }) {
  return (
    <kbd
      className={cx(
        "inline-flex min-w-10 items-center justify-center rounded-xs border px-3 py-1",
        "border-line-strong bg-surface-sunken",
        "font-mono text-label leading-flat text-ink-secondary",
      )}
    >
      {children}
    </kbd>
  );
}
