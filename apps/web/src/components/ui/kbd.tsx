import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * A key cap. Mono by construction, radius-xs (the innermost object), and case
 * is passed through as written — the vocabulary is key names (`Esc`, `⌘K`),
 * never transformed. `min-w-10` keeps a single character from collapsing to
 * a sliver. `muted` is the inline hint inside a button label: the button's
 * own ink at reduced weight, no box.
 *
 * `opacity-80`, and the number is measured rather than chosen. Opacity is a
 * composite against whatever is behind it, so one value has to clear WCAG 2.2
 * AA on every ground this cap is drawn on. At `opacity-60` — what this was —
 * the axe gate caught it on the primary button: white over the accent fill
 * composites to #BDB7D0 on #5B4C8A, 3.81:1 at 11px against a 4.5:1 floor.
 * The three grounds, at 80%:
 *
 *   white on accent (primary)          5.42:1
 *   ink-secondary on panel (ghost)     5.10:1
 *   ink-primary on panel (secondary)   9.64:1
 *
 * 75% was the first step that cleared the primary and it does NOT clear the
 * ghost (4.47:1), which is why the value is 80 and not the smallest number
 * that fixed the reported node. THE MACHINE THAT ENFORCES THIS is
 * `e2e/smoke/a11y-routes.spec.ts` — axe, at `error`, over every door —
 * plus the Storybook a11y addon over `kbd.stories.tsx`. Neither is a comment.
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
        className={cx("font-mono text-label leading-flat opacity-80", className)}
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
