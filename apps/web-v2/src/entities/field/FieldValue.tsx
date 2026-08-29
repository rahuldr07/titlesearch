import type { Field, NaReason } from "@titlepipe/contract";
import { enginesDisagree, hasNoProvenance, isExcluded } from "./fieldLabel";
import { NoValue } from "./NoValue";
import type { NoValueKind } from "./noValueStates";
import { PageChip } from "./PageChip";

/** The four document answers, mapped to the six-arm render union. */
/*
 * EXPORTED SO THE CHOICE ITSELF IS TESTABLE. `noValueClasses` and
 * `describeNoValue` are both tested on `kind` — the INPUT — so until
 * `naReasonMapping.test.ts` reached this function, the mapping from the wire's
 * `na_reason` to the render nobody may collapse was the one link in the chain
 * with no test on it. A mutation swapping NOT_STATED's arm for NOT_FOUND's
 * passed the entire suite.
 */
export function noValueFor(reason: NaReason, page: number | null): NoValueKind {
  switch (reason) {
    case "NOT_PRESENT":
      return { kind: "not_present" };
    case "NOT_FOUND":
      return { kind: "not_found" };
    case "NOT_STATED":
      return { kind: "silent" };
    case "PRESENT_UNREADABLE":
      return { kind: "unreadable", page: page ?? 0 };
  }
}

/**
 * ONE FIELD'S VALUE, WHEREVER IT IS PRINTED.
 *
 * Two copies of this existed: an entity that took a `value` string with a
 * required-but-nullable `provenance`, and a `SheetValue` in the review feature
 * that took a `Field`. Only the second could render the NA states, and only the
 * first refused an uncited value — so the sheet could print a value with no
 * source, and the entity could collapse four different NA answers into a blank.
 * This is the union, over the contract shape, and there is no second copy.
 *
 * NEVER EMIT A VALUE YOU CANNOT CITE (principle 6, `review.spec` #2). A value
 * with no document, no page and no reading behind it is not a fact — it is a
 * string of unknown origin sitting in a report, and it renders as a visible
 * error rather than as an ordinary value. The design has no arm for this, so
 * the treatment is INVENTED and flagged (`conflicts.md`).
 *
 * THE FOUR NA STATES NEVER COLLAPSE, and `pending` is a fifth thing — the
 * pipeline has not looked. `NoValue` carries the distinction in border style
 * and fill so it survives greyscale; this component only decides WHICH of them
 * is true, from `na_reason` and `value`, never from confidence.
 *
 * A HUMAN DECISION IS LABELLED AS ONE. "Your correction" and "Escalated to
 * senior review" are not styling — they are the difference between a value the
 * machine produced and a value a person stood behind, and the sheet is the last
 * place that distinction is visible before the document goes out.
 *
 * CONTRACT GAP: `value_raw` has no member on `Field`, so the normalised value
 * stands alone here. BRIEF §8 forbids merging the two, which this satisfies by
 * having only one — but a reviewer checking a normalisation against the page
 * still cannot see what was printed there.
 */
export function FieldValue({
  field,
  onViewSource,
}: {
  field: Field;
  /** Scrolls the document pane to the cited line. Absent on read-only surfaces. */
  onViewSource?: ((page: number) => void) | undefined;
}) {
  const page = field.source_page;

  if (isExcluded(field)) {
    // The row is OFF the sheet, and says so. A suppressed line that simply
    // vanished would be indistinguishable from one nobody looked at.
    return <span className="text-base text-ink-muted">Excluded — not our party</span>;
  }

  if (field.state === "escalated") {
    return (
      <span className="text-base text-state-attend-ink">
        ↗ Escalated to senior review
      </span>
    );
  }

  if (field.value === null && field.na_reason !== null) {
    return (
      <span className="flex flex-wrap items-baseline gap-3">
        <NoValue value={noValueFor(field.na_reason, page)} />
        {field.na_reason === "PRESENT_UNREADABLE" && page !== null ? (
          <PageChip page={page} onView={onViewSource} />
        ) : null}
      </span>
    );
  }

  if (field.value === null) {
    return (
      <span className="flex flex-wrap items-baseline gap-3">
        <NoValue value={{ kind: enginesDisagree(field) ? "unsettled" : "pending" }} />
        <span className="text-tiny text-ink-muted">not on the sheet yet</span>
      </span>
    );
  }

  if (hasNoProvenance(field)) {
    /*
     * A STAMP, NOT A TINT. The mockup draws the no-source tag as the one
     * SOLID-FILLED chip in the field column and defends the choice in its own
     * margin notes — an uncited value outranks the palette's "solid fill means
     * you may press this" discipline, because it is the only render here that
     * is an ERROR rather than an answer. It stays in the halt family rather
     * than taking the mockup's literal accent: red-that-means-stopped and
     * red-that-means-press must not become the same red. `ink-on-action` on
     * `state-halt` is gated in contrast.test.ts's filled-control sweep.
     */
    return (
      <span
        role="alert"
        className="inline-flex items-center gap-3 rounded-2 bg-state-halt px-4 py-2 text-micro font-bold uppercase tracking-eyebrow text-ink-on-action"
      >
        <span aria-hidden>⚠</span>
        NO PROVENANCE — this value cannot be shown without its source
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-baseline gap-3">
      <span className="font-mono text-base text-ink-primary">{field.value}</span>
      {page === null ? (
        <span className="text-tiny font-semibold text-state-halt-ink">
          no page cited
        </span>
      ) : (
        <PageChip page={page} onView={onViewSource} />
      )}
      {field.state === "corrected" ? (
        <span className="text-tiny font-semibold text-action">Your correction</span>
      ) : null}
    </span>
  );
}
