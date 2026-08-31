import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * A key cap. Mono by construction, radius-xs (the innermost object), and case
 * is passed through as written — the vocabulary is key names (`Esc`, `⌘K`),
 * never transformed. `min-w-10` keeps a single character from collapsing to
 * a sliver. `muted` is the inline hint inside a button label: the button's
 * own ink at reduced weight, no box.
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
