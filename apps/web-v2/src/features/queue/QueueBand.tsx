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
 * The note beside it is the band's standing description, never a count. The
 * design prints "2 stopped · needs someone"; the count is the server's and no
 * endpoint supplies it here, so the band carries the phrase and omits the
 * number rather than inventing one.
 */
export function QueueBand({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-4 px-1">
        <Eyebrow variant="group" as="h2">
          {title}
        </Eyebrow>
        <span className="text-sm text-ink-muted">{note}</span>
      </div>
      {children}
    </section>
  );
}
