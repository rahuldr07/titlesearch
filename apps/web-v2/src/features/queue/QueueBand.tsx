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
 * VIOLET ON ONE LABEL ONLY. The export draws every band name in ink and NEXT UP
 * in `--violet`, pairing with the accented card beneath it to mark the live
 * step — the same meaning violet carries in `Eyebrow`'s own note. Drawn in ink
 * like the rest, the one band the reader is meant to act on had no more weight
 * than the history below it. `tone` is a GIVEN, never read off the title: a
 * `title === "Next up"` test here would be this component deciding which band
 * is live, and the band order is the screen's argument, not the label's.
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
      <div className="flex flex-wrap items-baseline gap-4 px-1">
        <Eyebrow variant="group" tone={tone} as="h2" data-testid="band-label">
          {title}
        </Eyebrow>
        <span data-testid="band-note" className="text-sm text-ink-muted">
          {count === undefined ? note : `${count} ${note}`}
        </span>
      </div>
      {children}
    </section>
  );
}
