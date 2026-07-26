import type { NaReason } from "@titlepipe/contract";

/**
 * The no-value vocabulary — FIVE renders, four of which are NA states.
 *
 * Kept as a pure module, separate from the component, for one reason: it is
 * the single most consequential piece of logic in the UI and it must be
 * exhaustively testable without a DOM. `describeNoValue` has a `never` guard,
 * so adding a member to the contract's NaReason without handling it here is a
 * COMPILE error, not a silent grey dash.
 *
 * The four NA states are statements about the DOCUMENT (CONTEXT §11, ratified
 * 2026-07-26 — see docs/frontend/open-rulings.md Q1). `pending` is a statement
 * about the PIPELINE and is deliberately NOT an NaReason member: "we have not
 * looked yet" is not "the document does not say".
 *
 * Collapsing any of these is the ghost-chasing bug. The design's own States
 * Gallery puts it best: "They must never collapse into one grey dash."
 */

export type NoValue =
  | { readonly kind: "pending" }
  | { readonly kind: "unsettled" }
  | { readonly kind: "not_present" }
  | { readonly kind: "not_found" }
  | { readonly kind: "not_stated" }
  | { readonly kind: "unreadable"; readonly page: number | null };

/**
 * `tone` is PRESENTATION ONLY — how loudly this renders. It is never routing.
 * Whether a field needs review is `field.state`, which the server owns and the
 * UI renders verbatim (CONTEXT §7). Nothing here may be used to decide what a
 * reviewer sees in their queue.
 */
export type NoValueTone =
  /** correct and expected; recedes, never prompts action */
  | "quiet"
  /** a real gap in the record; surfaced */
  | "surfaced"
  /** on the page and unreadable; the loudest of the four */
  | "halt"
  /** not an NA state at all — the pipeline has not reached it */
  | "pipeline"
  /** not an NA state — engines returned values and disagreed; nothing settled */
  | "unsettled";

export interface NoValueDescriptor {
  readonly testId: string;
  readonly label: string;
  readonly tone: NoValueTone;
  /** only `unreadable` cites a page — it is the one state that exists ON a page */
  readonly carriesPage: boolean;
}

export function describeNoValue(v: NoValue): NoValueDescriptor {
  switch (v.kind) {
    case "pending":
      // NEVER "Not Available" — that would collapse a pipeline state into a
      // document state and send reviewers chasing a gap that may not exist.
      return {
        testId: "nv-pending",
        label: "not yet extracted",
        tone: "pipeline",
        carriesPage: false,
      };
    case "unsettled":
      // The engines DID read this field and returned different values. Nothing
      // is settled, but the field is emphatically not empty — saying "not yet
      // extracted" or "Not Available" here would be a false claim of absence
      // while the readings sit right there. Principle 6, mirrored: never
      // assert an absence you cannot substantiate.
      return {
        testId: "nv-unsettled",
        label: "nothing settled — the readings disagree",
        tone: "unsettled",
        carriesPage: false,
      };
    case "not_present":
      return {
        testId: "nv-not-present",
        label: "n/a — not used in this jurisdiction",
        tone: "quiet",
        carriesPage: false,
      };
    case "not_found":
      return {
        testId: "nv-not-found",
        label: "Not found — searched, none of record",
        tone: "surfaced",
        carriesPage: false,
      };
    case "not_stated":
      return {
        testId: "nv-not-stated",
        label: "Document silent — not stated on any page",
        tone: "surfaced",
        carriesPage: false,
      };
    case "unreadable":
      return {
        testId: "nv-unreadable",
        label: "Present — unreadable on page",
        tone: "halt",
        carriesPage: true,
      };
    default: {
      // Exhaustiveness guard. If this stops compiling, the contract grew a
      // member and it MUST be given its own render — never a default arm.
      const unhandled: never = v;
      throw new Error(
        `unhandled no-value kind: ${JSON.stringify(unhandled)} — every NA state needs its own render`,
      );
    }
  }
}

/**
 * Read a field's no-value state off the wire. Returns null when the field HAS
 * a value — the caller renders the value instead.
 *
 * This is the ONE place a null `value` is legitimately read, and it is reading
 * the server's own encoding, not deriving anything. Nothing downstream may key
 * off null again — that is the collapse this module exists to prevent.
 *
 * The `unsettled` case is why `readings` has to be consulted here. The contract
 * encodes "not yet extracted" and "the engines disagreed and nothing merged"
 * IDENTICALLY at the top level — both are `value: null, na_reason: null` — and
 * only the presence of readings tells them apart. Treating the second as the
 * first tells a reviewer the field is empty while two candidate values sit in
 * the payload, which is the exact defect ux.spec's "a both-found disagreement
 * never claims emptiness" exists to catch.
 *
 * Note this reads readings to pick a RENDER, never to pick a state: `state` is
 * already `needs_review` from the server, and nothing here changes that.
 *
 * CONTRACT GAP: the two cases would be safer as distinct server-side encodings
 * — an explicit `unsettled` marker, or an `na_reason` member — so a client that
 * forgets to look at `readings` cannot silently claim absence.
 */
export function noValueOf(field: {
  readonly value: string | null;
  readonly na_reason: NaReason | null;
  readonly source_page?: number | null;
  readonly readings?: readonly { readonly value: string | null }[] | undefined;
}): NoValue | null {
  if (field.na_reason !== null) {
    switch (field.na_reason) {
      case "NOT_PRESENT":
        return { kind: "not_present" };
      case "NOT_FOUND":
        return { kind: "not_found" };
      case "NOT_STATED":
        return { kind: "not_stated" };
      case "PRESENT_UNREADABLE":
        return { kind: "unreadable", page: field.source_page ?? null };
      default: {
        const unhandled: never = field.na_reason;
        throw new Error(`unhandled na_reason: ${JSON.stringify(unhandled)}`);
      }
    }
  }
  if (field.value === null) {
    // engines read it and returned something — nothing merged, but not empty
    const read = (field.readings ?? []).some((r) => r.value !== null);
    return read ? { kind: "unsettled" } : { kind: "pending" };
  }
  return null;
}
