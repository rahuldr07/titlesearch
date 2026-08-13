import type { ReactNode } from "react";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * One band of the queue: a label on the BACKDROP, with its cards below.
 *
 * The label is deliberately NOT a card header. In the design every band name
 * sits on the grey ground with the paper starting beneath it, which is what
 * makes the page read as four separate piles of work rather than one stack of
 * identical panels. Wrapping the label in paper — as this screen previously did
 * — merges the label into the thing it is labelling and costs the reader the
 * only structural cue the page has.
 *
 * THE COUNT IS THE SERVER'S CENSUS, RENDERED, NEVER RE-DERIVED. The design
 * prints "2 stopped · needs someone"; `GET /api/queue/bands` serves that `2` as
 * its own field and the rest as `note`, so the band interpolates two given
 * strings rather than counting the rows beneath it. Those two numbers are not
 * the same number: the row list is scoped to what the caller may open and the
 * census is not, so `orders.length` here would show a reviewer their permissions
 * as though work had disappeared (hard rule 3, and the contract states it on the
 * field). It is a count of what is LEFT — never a rate, and §4.5 means there
 * never may be one.
 *
 * "Next up" passes no count and gets none: it is the one order the server chose,
 * and a "1" beside it would invite the reader to wonder what the other number
 * would have been.
 *
 * THE ACCENT LEFT THE BAND LABEL 2026-08-01. The old export drew NEXT UP in
 * `--violet` to mark the live step. RULE: the sealing wax is spent ONCE per
 * screen, on the one action (Eyebrow.tsx, Button.tsx). FAILURE PREVENTED: the
 * mockup draws all three band heads identically at `--ink-2` (`.bh-lbl`) and
 * keeps the wax for "Take next order"; a wax band label above a wax button is
 * the accent inflation the reskin exists to undo, and the label is not the
 * press. `tone` survives as an axis because it is a GIVEN a future band may
 * need — never read off the title, since a `title === "Next up"` test here
 * would be this component deciding which band is live.
 *
 * THE HAIRLINE AFTER THE LABEL IS THE MOCKUP'S BAND RHYTHM (`.bh-rule`, `flex:1
 * height:1px`). FAILURE PREVENTED: without it a band head is two short words
 * floating on the ground and the eye has nothing to travel along to the sheet
 * below; with it, the label reads as a rule broken to let a word through, which
 * is what makes four bands scan as four filed piles rather than four paragraphs.
 * It is `aria-hidden` decoration and carries no meaning of its own.
 */
export function QueueBand({
  title,
  note,
  count,
  tone,
  children,
}: {
  title: string;
  note: string;
  /** The server's census for this band. Omitted where the server sends none. */
  count?: number | undefined;
  /** `action` on the live band only. Everything else keeps the ink default. */
  tone?: "action" | undefined;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      {/* `.band-head` — label, census, rule. `section` is the mockup's band-head
          metric exactly (10.5px / .14em / 700 / ink-2); `group` is the NAV's
          group label and one size down, which is why this read as a caption. */}
      <div className="flex flex-wrap items-baseline gap-5 px-1">
        <Eyebrow variant="section" tone={tone} as="h2" data-testid="band-label">
          {title}
        </Eyebrow>
        {/* Mono and tabular because the leading figure is the SERVER'S census
            (`.bh-count`), and a census sits in the same numeral family as every
            other number in this product. The words after it are the server's
            own and are printed in the case it sent — CSS caps would be the
            screen restyling a sentence it did not write. */}
        <span data-testid="band-note" className="tnum font-mono text-xs text-ink-muted">
          {count === undefined ? note : `${count} ${note}`}
        </span>
        {/* `line-strong`, not the mockup's `--line-soft`: the mockup rules its
            band head on the SHEET and ours sits on the app ground, where the
            subtle rule is lighter than the surface it is drawn on and vanishes.
            Same rule, re-measured against what it actually sits on. */}
        <span aria-hidden className="h-px min-w-8 flex-1 bg-line-strong" />
      </div>
      {children}
    </section>
  );
}
