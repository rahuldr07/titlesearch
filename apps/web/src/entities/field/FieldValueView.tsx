import type { ComponentProps } from "react";
import type { FieldValue } from "../../shared/provenance";
import { assertNever } from "../../shared/provenance";
import { cx } from "../../components/ui";
import { CitationRef } from "./CitationRef";
import { NoValueChip } from "./NoValueChip";

/**
 * The renders of a field value, kept exhaustive by the `never` guard. The
 * union is flat — each NA reason is its own `kind` — so a single
 * `case "na"` cannot collapse the four into one grey dash: dropping any one
 * fails to compile. Every render differs in text, mark and
 * `data-field-render`. Nothing here derives — no confidence, no
 * `value === null`, no thresholds; the component prints the classification
 * the server's own fields produced.
 */
export type FieldValueViewProps = {
  readonly value: FieldValue;
  /** Click-to-source. Passed straight to `CitationRef`; never composed here. */
  readonly onOpenCitation?: CitationOpen | undefined;
  readonly className?: string | undefined;
};

type CitationOpen = NonNullable<ComponentProps<typeof CitationRef>["onOpen"]>;

export function FieldValueView({ value, onOpenCitation, className }: FieldValueViewProps) {
  switch (value.kind) {
    /** A field value is data, so it is mono. */
    case "cited":
      return (
        <span data-field-render="cited" className={cx("flex flex-col gap-1", className)}>
          <span className="font-mono text-body leading-close text-ink-primary">
            {value.cited.value}
          </span>
          <CitationRef citation={value.cited.citation} onOpen={onOpenCitation} />
        </span>
      );

    /**
     * The defect render. A value with no source is the failure the
     * provenance envelope exists to catch, so it is drawn in the halt family
     * with the missing-source sentence stated. The server has already routed
     * it to review; this says so, it does not decide it.
     */
    case "uncited":
      return (
        <span
          data-field-render="uncited"
          className={cx(
            "flex flex-col gap-1 border-l-2 border-state-halt pl-4",
            className,
          )}
        >
          <span className="font-mono text-body leading-close text-state-halt">
            {value.value}
          </span>
          <span className="font-sans text-label leading-close text-state-halt">
            No source on record — cannot be cited
          </span>
        </span>
      );

    case "not-extracted":
      return <NoValueChip render="not-extracted" className={className} />;

    /**
     * The three NA reasons that carry no page reference. Written out one by
     * one rather than folded together: folding them is the collapse, and the
     * whole point of the flat union is that the compiler counts them.
     */
    case "na-not-present":
      return <NoValueChip render="NOT_PRESENT" className={className} />;

    case "na-not-found":
      return <NoValueChip render="NOT_FOUND" className={className} />;

    case "na-not-stated":
      return <NoValueChip render="NOT_STATED" className={className} />;

    /**
     * PRESENT_UNREADABLE is the only member carrying a page reference. The
     * type permits a citation on this branch only; the server decides
     * whether there is one.
     */
    case "na-present-unreadable":
      return (
        <NoValueChip render="PRESENT_UNREADABLE" className={className}>
          {value.citation !== null && (
            <CitationRef citation={value.citation} onOpen={onOpenCitation} />
          )}
        </NoValueChip>
      );

    default:
      return assertNever(value, "FieldValueView");
  }
}
