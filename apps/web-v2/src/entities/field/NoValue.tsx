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
 * THE MARKS ARE THE MOCKUP'S, as of the 2026-08-01 reskin — its "HOW ABSENCE IS
 * WRITTEN" key draws the grammar explicitly, and tokens.css states the same set
 * in the same order ("solid+filled / dashed+empty / solid+dotted / hatched /
 * dotted+empty"). Two marks TRADED PLACES against the previous build and the
 * swap is the point of the revision, not a tidy-up:
 *
 *   not_present  was dashed + empty + italic serif → now SOLID stroke, SOLID
 *                fill. It is the settled, expected answer; a filled chip is a
 *                closed question, and dashed now belongs to the state that
 *                actually went looking.
 *   not_found    → DASHED stroke, EMPTY. A search that returned nothing leaves
 *                an outline with nothing in it, which is what it means.
 *   silent       was the hatch → now a sparse DOT fill: read, and it does not
 *                say. Quiet, not damaged.
 *   unreadable   was a flat tint → now the HATCH, and the hatch is damage: the
 *                mark you make over something you cannot transcribe. It is the
 *                only hatched member of the set, which is the distinction
 *                CONTEXT §11 actually leans on for this state.
 *
 * The renders are UPPERCASE MICRO CAPS because every chip in the approved
 * screens is, and because a no-value chip sits inline beside real values: the
 * caps are what stop "not found" being misread as a value someone typed.
 *
 * Two of the six are NOT DRAWN by the design and are flagged as such:
 *   `pending`   — state-coverage.md §2.1 records this as a gap needing a redraw.
 *                 Dotted + empty per the mockup's key, but keeping the attend
 *                 border: an answer is owed, and `variants.test.ts` pins that.
 *   `unsettled` — invented during the previous rebuild; takes the ATTEND
 *                 treatment because the field is waiting on a person, and never
 *                 the quiet grey of an NA state, which would read as "nothing
 *                 here" when two candidate readings exist. Its stroke is DOUBLE
 *                 — two readings, two lines — which is also what keeps it out
 *                 of `not_present`'s new filled-and-bordered signature.
 */
/* eslint-disable-next-line react-refresh/only-export-components -- exported so the variant logic is testable as a pure function in the node gate; a mutation audit showed component tests alone never caught a collapsed variant set. */
export const noValueClasses = cva(
  "inline-flex items-center gap-3 rounded-2 px-4 py-2 text-micro font-semibold uppercase tracking-badge",
  {
    variants: {
      kind: {
        // NOT DRAWN — provisional. Dotted + empty; the stroke stays attend-toned.
        pending: "border border-dotted border-state-attend-border text-ink-muted",
        // NOT DRAWN — provisional. Double stroke: two candidate readings.
        unsettled:
          "border-(length:--stroke-stamp) border-double border-state-attend-border bg-state-attend-surface text-state-attend-ink",
        // Drawn: solid stroke, solid fill. A closed question.
        not_present: "border border-na-not-present-border bg-surface-app text-na-not-present-ink",
        // Drawn: dashed stroke, empty, with a leading dash glyph.
        not_found: "border border-dashed border-na-not-found-border text-na-not-found-ink",
        // Drawn: sparse dot fill. The pattern is the signal, not the colour.
        silent: "na-dots border border-na-not-found-border text-na-silent-ink",
        // Drawn: diagonal hatch over the attend tint, with a ◑ glyph.
        unreadable:
          "na-hatch border border-na-unreadable-border bg-na-unreadable-surface text-na-unreadable-ink",
      },
    },
  },
);

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
