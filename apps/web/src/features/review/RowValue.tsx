import type { FieldValue } from "../../shared/provenance";
import { assertNever } from "../../shared/provenance";
import { cx } from "../../components/ui";

/**
 * A NO-VALUE FIELD, AS A ROW — AND THE FIVE STAY FIVE.
 *
 * `NoValueChip` is the PANEL render: a bordered chip carrying the taxonomy's
 * full sentence ("On the page — could not be read"). A 1fr column in a dense
 * list cannot carry four sentences of that length and stay scannable, so the
 * row says the same five things in the row register: a lead, and a qualifier.
 *
 * ══ WHY FOUR OF THEM SHARE THE LEAD "Not Available" ════════════════════════
 *
 * Because the four NA reasons ARE four kinds of one thing — the document has no
 * value here — and the taxonomy's rule is that they must never collapse, not
 * that they must never rhyme. The qualifier is what carries the distinction,
 * and every one of the four is different in it. `noValueStates.ts` makes the
 * same argument about colour: "colour alone does not carry the distinction and
 * is not asked to".
 *
 * ══ WHY THE FIFTH DOES NOT ════════════════════════════════════════════════
 *
 * `enums.ts:44-47`: a null value with a null `na_reason` is NOT a member of the
 * NA taxonomy. It is a statement about the PIPELINE, not about the document —
 * nothing has read this field yet, and "Not Available" would assert that
 * somebody looked. So it takes no lead at all, and it is written as PROSE in
 * sentence case rather than as a record: the four are findings, this is the
 * absence of a finding, and the typography says which is which before the words
 * are read. INVARIANT 7 requires exactly this — "`pending` is a distinct third
 * render that never reads as either".
 *
 * ══ AND THE SIXTH IS A DEFECT, NOT AN ABSENCE ══════════════════════════════
 *
 * `uncited` is a value the server sent with no document, page or reading behind
 * it — `entities.ts:85-89`, "the exact failure shape the architecture exists to
 * catch". It renders in the halt family with the value still shown, because
 * hiding it would lose the evidence of the defect, and it says NO PROVENANCE in
 * the record register so it cannot be mistaken for a quiet absence.
 */
export type RowValueProps = {
  readonly value: FieldValue;
};

/** The four qualifiers. One per NA reason, all different — that is the rule. */
const QUALIFIER: Readonly<
  Record<Extract<FieldValue["kind"], `na-${string}`>, { text: string; chrome: string }>
> = {
  /** Structurally absent here. Correct, quiet, never surfaced (enums.ts:31-35). */
  "na-not-present": {
    text: "N/A — EXPECTED",
    chrome: "border-na-not-present-border text-na-not-present-ink bg-surface-sunken",
  },
  /** Searched, and there is nothing of record. A real gap IS a finding. */
  "na-not-found": {
    text: "N/A — NONE OF RECORD",
    chrome: "border-dashed border-na-not-found-border text-na-not-found-ink",
  },
  /** The document came back and does not say. Distinct from none of record. */
  "na-not-stated": {
    text: "N/A — INSTRUMENT SILENT",
    chrome: "border-na-not-found-border text-na-silent-ink tp-na-hatch",
  },
  /** On the page and unreadable. The only one carrying a page reference. */
  "na-present-unreadable": {
    text: "PRESENT — UNREADABLE",
    chrome:
      "border-na-unreadable-border bg-na-unreadable-surface text-na-unreadable-ink",
  },
};

const CHIP =
  "inline-flex items-center rounded-sm border px-3 font-sans text-label leading-flat font-semibold";

export function RowValue({ value }: RowValueProps) {
  switch (value.kind) {
    /** Rule 3: a field value is data, so it is mono. */
    case "cited":
      return (
        <span
          data-field-render="cited"
          className="truncate font-mono text-meta leading-close text-ink-primary"
        >
          {value.cited.value}
        </span>
      );

    case "uncited":
      return (
        <span data-field-render="uncited" className="flex min-w-0 items-center gap-4">
          <span className="truncate font-mono text-meta leading-close text-state-halt">
            {value.value}
          </span>
          <span className={cx(CHIP, "border-state-halt-border bg-state-halt-surface text-state-halt")}>
            NO PROVENANCE
          </span>
        </span>
      );

    /**
     * Sentence case, no lead, no chip border — a pipeline statement, and it
     * must never read as one of the four findings above.
     */
    case "not-extracted":
      return (
        <span
          data-field-render="not-extracted"
          className="font-sans text-meta leading-close text-ink-faint italic"
        >
          not yet extracted
        </span>
      );

    case "na-not-present":
    case "na-not-found":
    case "na-not-stated":
    case "na-present-unreadable": {
      const qualifier = QUALIFIER[value.kind];
      return (
        <span
          data-field-render={value.kind}
          className="flex min-w-0 flex-wrap items-center gap-4"
        >
          <span className="font-sans text-meta leading-close text-ink-muted">
            Not Available
          </span>
          <span className={cx(CHIP, qualifier.chrome)}>{qualifier.text}</span>
        </span>
      );
    }

    default:
      return assertNever(value, "RowValue");
  }
}
