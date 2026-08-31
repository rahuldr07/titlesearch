import type { FieldValue } from "../../shared/provenance";
import { assertNever } from "../../shared/provenance";
import { cx } from "../../components/ui";

/**
 * A field value, as a row — and the five no-value renders stay five.
 */
export type RowValueProps = {
  readonly value: FieldValue;
};

/** The four qualifiers. One per NA reason, all different — that is the rule. */
const QUALIFIER: Readonly<
  Record<Extract<FieldValue["kind"], `na-${string}`>, { text: string; chrome: string }>
> = {
  /** Structurally absent here. Correct, quiet, never surfaced. */
  "na-not-present": {
    text: "N/A — EXPECTED",
    chrome: "border-na-not-present-border text-na-not-present-ink bg-surface-sunken",
  },
  /** Searched, and there is nothing of record. A real gap is a finding. */
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
    /** A field value is data, so it is mono. */
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
          <span
            className={cx(
              CHIP,
              "border-state-halt-border bg-state-halt-surface text-state-halt",
            )}
          >
            NO PROVENANCE
          </span>
        </span>
      );

    /*
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
