import type { ComponentProps } from "react";
import type { FieldValue } from "../../shared/provenance";
import { assertNever } from "../../shared/provenance";
import { cx } from "../../components/ui/cx";
import { CitationRef } from "./CitationRef";
import { NoValueChip } from "./NoValueChip";

/**
 * THE SIX RENDERS OF A FIELD VALUE, AND THE `never` GUARD THAT KEEPS THEM SIX.
 *
 * `provenance.ts` is the specification. Four NA reasons, plus a fifth
 * "not yet extracted" render that is a statement about the PIPELINE, plus
 * `uncited` — a value the server sent with no source, which `entities.ts:85-89`
 * calls "the exact failure shape the architecture exists to catch".
 *
 * The switch below has SEVEN cases because the union is flat: each NA reason
 * is its own `kind`. That is the B2 fix. Under the old shape a single
 * `case "na": return <span>—</span>` collapsed all four into one grey dash and
 * satisfied the `never` guard while doing it. It cannot now — dropping any one
 * of the four fails to compile here.
 *
 * Every render differs in TEXT, in MARK and in `data-field-render`. The last is
 * what a test and a Playwright assertion read: "they must never collapse into
 * one grey dash" is only a real rule if something can fail when they do.
 *
 * NOTHING HERE DERIVES. No confidence, no `value === null`, no thresholds. The
 * component is handed a classification the server's own fields produced and it
 * prints it.
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
    /** Rule 3: a field value is data, so it is mono. */
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
     * THE DEFECT RENDER. Not a quieter cited value — a value with no source is
     * the failure the provenance envelope exists to catch, so it is drawn in the
     * halt family with the missing-source sentence stated, never silently.
     * The server has already routed it to review; this says so, it does not
     * decide it.
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
     * PRESENT_UNREADABLE is the only member carrying a page reference
     * (`enums.ts:41-43`) — and the citation is rendered when the server sent
     * one rather than when the reason says it may. The type permits a citation
     * on THIS branch only; the server decides whether there is one.
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
