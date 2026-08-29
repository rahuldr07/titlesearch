import type { ReactNode } from "react";

/**
 * THE SPLIT'S STORY FIXTURES, SHARED BY TWO STORY FILES.
 *
 * `resizable.stories.tsx` shows the geometry — the band, both orientations, the
 * panes scrolling inside it. `resizable.a11y.stories.tsx` shows the two things
 * that are invisible on screen and are the reason the component was adapted at
 * all: the WCAG 2.2 §2.5.7 keyboard alternative to dragging, and the chord
 * scope mark. Two subjects, two files, one set of contents — repeating the
 * fixture in both is how the two drift into demonstrating different things.
 *
 * A fixture module rather than an export from a `.stories.tsx`: Storybook reads
 * every non-`default` export of a story file as A STORY, so a shared `Frame`
 * exported from one would appear in the gallery as a broken entry.
 */

/**
 * A split with no height is two panels of nothing. `overflow-hidden` is the
 * frame's own rule (styles.css: the app is one viewport tall and never
 * scrolls), restated here so a story cannot demonstrate the thing the design
 * forbids.
 */
export function Frame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="h-160 w-320 overflow-hidden rounded-lg border border-line-strong">
      {children}
    </div>
  );
}

/** The left half: the decision column, at the type sizes §7 actually uses. */
export function Decision() {
  return (
    <div className="flex flex-col gap-5 p-8">
      <p className="font-sans text-subject leading-tight font-semibold text-ink-primary">
        Vesting
      </p>
      <p className="font-sans text-meta leading-body text-ink-secondary">
        Ana R. Delgado, a single woman, as her sole and separate property.
      </p>
    </div>
  );
}

/** The right half. Rule 8: evidence renders AS PAPER — serif, warm stock. */
export function Evidence() {
  return (
    <div className="h-full bg-surface-paper p-8 font-serif leading-document text-page-ink">
      Know all men by these presents, that the grantor, for and in consideration
      of ten dollars and other good and valuable consideration, does hereby
      grant.
    </div>
  );
}
