import type { Field, NaReason } from "@titlepipe/contract";
import { enginesDisagree } from "./fieldLabel";
import { NoValue } from "../../entities/field/NoValue";
import type { NoValueKind } from "../../entities/field/noValueStates";

/** The four document answers, mapped to the six-arm render union. */
function noValueFor(reason: NaReason, page: number | null): NoValueKind {
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
 * One line of the draft sheet.
 *
 * A HUMAN DECISION IS LABELLED AS ONE. "Your correction" and "Escalated to
 * senior review" are not styling — they are the difference between a value the
 * machine produced and a value a person stood behind, and the sheet is the last
 * place that distinction is visible before the document goes out.
 *
 * THE PAGE CITE RIDES EVERY VALUE. A value with no page is not quietly bare; it
 * says so, because a sheet that renders unciteable values indistinguishably
 * from citeable ones is how one reaches a client.
 */
export function SheetValue({ field }: { field: Field }) {
  const page = field.source_page;
  const cite =
    page === null ? (
      <span className="text-tiny text-state-halt-ink">no page cited</span>
    ) : (
      <span className="font-mono text-tiny text-ink-muted">p{page}</span>
    );

  if (field.state === "escalated") {
    return (
      <span className="text-base text-state-attend-ink">↗ Escalated to senior review</span>
    );
  }

  if (field.value === null && field.na_reason !== null) {
    return (
      <span className="flex flex-wrap items-baseline gap-3">
        <NoValue value={noValueFor(field.na_reason, page)} />
        {field.na_reason === "PRESENT_UNREADABLE" ? cite : null}
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

  return (
    <span className="flex flex-wrap items-baseline gap-3">
      <span className="font-mono text-base text-ink-primary">{field.value}</span>
      {cite}
      {field.state === "corrected" ? (
        <span className="text-tiny font-semibold text-action">Your correction</span>
      ) : null}
    </span>
  );
}
