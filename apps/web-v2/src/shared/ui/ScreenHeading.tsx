import { cva } from "class-variance-authority";
import type { ReactElement, ReactNode } from "react";
import { Link } from "@tanstack/react-router"; // rules-allow: §6 bans a fetch in shared/, and a <Link> is markup, not a fetch — ux.spec #7 requires the hub link on the title itself, which no prop can carry
import { Eyebrow } from "./Eyebrow";

/**
 * A screen's masthead — eyebrow, h1 and lede as ONE unit.
 *
 * A MOUSE USER IS NEVER STRANDED (`ux.spec` #7). The eyebrow is the link back
 * to the hub, and it lives INSIDE this component rather than beside it because
 * that is the only arrangement a call site cannot forget. Fifteen screens draw
 * this masthead; the moment the link is the caller's job, the screens written
 * before the rule — or after it, in a hurry — become screens a mouse user can
 * only leave by keyboard chord. `data-testid="screen-title"` is part of that
 * contract, not a test convenience: `ux.spec` asserts it per screen, and
 * commit c2e9011 already deleted the rail that used to carry the rule once.
 */
/**
 * ONE MEASURE FOR THE LEDE. The fifteen mastheads set it six different ways —
 * 370px, 468px, 470px, 570px, `max-w-prose` and `max-w-3xl` (768px) — with
 * seven different gaps between the same three elements. At 768px the 12.5px
 * body runs to ~100 characters and the eye loses the start of the next line;
 * 470px sets ~62, and is the value two unrelated screens landed on separately.
 *
 * ACTIONS SIT ON THE HEADING ROW, never at the foot of the lede. Every current
 * site bottom-aligns its control against the whole block, so "+ New rule"
 * drops further from the title the longer the sentence beneath it runs, until
 * it reads as belonging to the paragraph. Pairing it with the h1 fixes the
 * association whatever the lede does.
 *
 * `size` IS AN AXIS BECAUSE THE EXPORT HAS ONE — 22px on most screens, 26px on
 * a few; `--text-3xl` and `--text-5xl` are named for exactly those two. It is
 * not a knob for taste. A third value means the export grew a third size.
 */
const heading = cva("font-semibold text-ink-primary", {
  variants: {
    size: {
      /** the screen h1 the design draws almost everywhere (22px) */
      "22": "text-3xl",
      /** the few it draws larger — upload is the clearest (26px) */
      "26": "text-5xl",
    },
  },
  defaultVariants: { size: "22" },
});

export interface ScreenHeadingProps {
  /** The kicker. It is the link home; do not wrap it in one. */
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  size?: "22" | "26";
  /** Right-aligned controls on the heading row. */
  actions?: ReactNode;
}

export function ScreenHeading({
  eyebrow,
  title,
  lede,
  size,
  actions,
}: ScreenHeadingProps): ReactElement {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Link to="/" data-testid="screen-title" className="w-fit">
            <Eyebrow variant="screen">{eyebrow}</Eyebrow>
          </Link>
          <h1 className={heading({ size })}>{title}</h1>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-7">{actions}</div>
        ) : null}
      </div>
      {/*
       * A `div`, not a `p`. Overview's lede is two paragraphs — the thesis and
       * the server's scope note, which answer different questions and must not
       * run together — and a `<p>` inside a `<p>` is auto-closed by the parser,
       * which silently reorders the DOM rather than failing.
       */}
      {lede ? (
        <div className="flex max-w-235 flex-col gap-3 text-base leading-body text-ink-secondary">
          {lede}
        </div>
      ) : null}
    </header>
  );
}
