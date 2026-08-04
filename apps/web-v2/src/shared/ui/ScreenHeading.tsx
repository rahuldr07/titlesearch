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
 * THE ITALIC IS THE DESIGN'S SIGNATURE, AND IT IS PLAIN `<em>`.
 *
 * RULE: the mockup sets the closing phrase of a heading in Fraunces italic at
 * the accent's deep ink — `Work comes <em>to you.</em>`, `Client settings &
 * <em>overrides</em>`. FAILURE PREVENTED: the only other way to reach it is a
 * `<span className="font-display italic text-action-ink">` typed out at each of
 * fifteen mastheads, which is four tokens a call site can get wrong in four
 * ways and which nothing would catch. Styling the descendant `<em>` here means
 * a call site writes the SEMANTIC element and this component supplies every
 * value — and a heading that never emphasises anything pays nothing for it.
 *
 * ONE MEASURE FOR THE LEDE, now 560px (`max-w-280`) at the mockup's 13.5px —
 * ~78 characters. The fifteen mastheads used to set it six different ways.
 *
 * ACTIONS SIT ON THE HEADING ROW, never at the foot of the lede, so the control
 * does not drift further from the title the longer the sentence beneath it runs.
 *
 * `size` IS AN AXIS BECAUSE THE DESIGN HAS ONE — the mockup draws exactly two
 * display sizes, 30px for the common masthead and 38px for the featured one.
 * The value names are the OLD export's pixel sizes and are now stale labels;
 * they are kept because `IngestScreen` passes `size="26"` and renaming a value
 * would break a call site this task does not own. The ORDER is what they mean:
 * "22" is the smaller, "26" the larger. A third value means the design grew one.
 */
const heading = cva(
  [
    "-ml-1 font-display font-title leading-flat text-ink-primary",
    "[&_em]:font-normal [&_em]:italic [&_em]:text-action-ink",
  ],
  {
    variants: {
      size: {
        /** the masthead the design draws on most screens (30px) */
        "22": "text-5xl opsz-120",
        /** the few it draws larger — the queue and upload are the clearest (38px) */
        "26": "text-6xl opsz-144",
      },
    },
    defaultVariants: { size: "22" },
  },
);

export interface ScreenHeadingProps {
  /** The kicker. It is the link home; do not wrap it in one. */
  eyebrow: ReactNode;
  /** Wrap the emphasised phrase in `<em>` — this component paints it. */
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
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
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
        <div className="flex max-w-280 flex-col gap-3 text-xl leading-body text-ink-secondary">
          {lede}
        </div>
      ) : null}
    </header>
  );
}
