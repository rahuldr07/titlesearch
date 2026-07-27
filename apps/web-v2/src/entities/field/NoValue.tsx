import { cva } from "class-variance-authority";
import { describeNoValue, type NoValueKind } from "./noValueStates";
import { cn } from "../../shared/ui/classNames";

/**
 * Renders a field that has no value.
 *
 * The six states MUST stay visually distinct — the design's own States Gallery
 * says "They must never collapse into one grey dash", and CONTEXT §11 makes it
 * a rule. Colour alone does not carry that: each state also differs in BORDER
 * STYLE or FILL PATTERN, so the distinction survives greyscale printing and
 * colour-blindness. Do not "simplify" these to colour-only.
 *
 * Two of the six are NOT DRAWN by the design and are flagged as such:
 *   `pending`   — state-coverage.md §2.1 records this as a gap needing a redraw.
 *   `unsettled` — invented during the previous rebuild; takes the ATTEND
 *                 treatment because the field is waiting on a person, and never
 *                 the quiet grey of an NA state, which would read as "nothing
 *                 here" when two candidate readings exist.
 */
/* eslint-disable-next-line react-refresh/only-export-components -- exported so the variant logic is testable as a pure function in the node gate; a mutation audit showed component tests alone never caught a collapsed variant set. */
export const noValueClasses = cva("inline-flex items-center gap-3 rounded-4 px-5 py-2 text-xs", {
  variants: {
    kind: {
      // NOT DRAWN — provisional. Attend-toned: an answer is owed.
      pending: "border border-dashed border-state-attend-border bg-state-attend-surface text-state-attend-ink",
      // NOT DRAWN — provisional. Attend-toned: a person must resolve it.
      unsettled: "border border-state-attend-border bg-state-attend-surface font-semibold text-state-attend-ink",
      // Drawn: dashed border + italic serif. Quiet — this is correct, not a gap.
      not_present: "border border-dashed border-na-not-present-border font-quote italic text-na-not-present-ink",
      // Drawn: solid border on the app surface, with a leading dash glyph.
      not_found: "border border-na-not-found-border bg-surface-app text-na-not-found-ink",
      // Drawn: diagonal hatch. The pattern is the signal, not the colour.
      silent: "na-hatch border border-na-not-found-border text-na-silent-ink",
      // Drawn: halt-tinted with a ◑ glyph — the only NA state that is a problem.
      unreadable:
        "border border-na-unreadable-border bg-na-unreadable-surface font-semibold text-na-unreadable-ink",
    },
  },
});

export function NoValue({ value }: { value: NoValueKind }) {
  const { label, accessibleLabel } = describeNoValue(value);

  return (
    <span className={cn(noValueClasses({ kind: value.kind }))}>
      {/*
        Glyphs are decorative and hidden: the accessible name below carries the
        full phrase, so a screen-reader user gets the distinction that sighted
        users get from the border and fill.
      */}
      {value.kind === "not_found" ? (
        <span aria-hidden className="h-px w-5 bg-na-not-found-ink" />
      ) : null}
      {value.kind === "unreadable" ? <span aria-hidden>◑</span> : null}
      <span className="sr-only">{accessibleLabel}</span>
      <span aria-hidden>{label}</span>
    </span>
  );
}
