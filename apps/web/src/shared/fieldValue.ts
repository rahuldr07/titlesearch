/**
 * The shape of a cited value, and the six renders.
 * Split from `provenance.ts` (§6 length gate): this file is the VOCABULARY —
 * what a citation is, what a value carrying one is, and the six ways a field
 * can render. `provenance.ts` is the CLASSIFIER that reads a server field into
 * this vocabulary. Types here, decisions there.
 * Read `provenance.ts`'s header first. It states what is actually enforced
 * about provenance and what is not, and this file inherits every word of it:
 * `Cited<T>` makes a citation impossible to OMIT at construction and does
 * nothing to stop it being DROPPED at use. The lint pair named there is what
 * covers the second.
 */

import type { NaReason } from "@titlepipe/contract";

/** A citation. Both members present, or this is not a citation. */
export type Citation = {
  readonly docId: string;
  readonly page: number;
  readonly snippet: string | null;
};

/**
 * A value that carries its source. The ONLY shape a component may print a
 * field value from.
 * `Cited<T>` is deliberately not `{ value: T; citation?: Citation }` — an
 * optional citation is a citation you can forget.
 * Note the limit, stated because the header above used to hide it: a REQUIRED
 * citation you can destructure away is also a citation you can forget, one
 * keystroke later. This shape makes the citation impossible to OMIT at
 * construction. It does not make it impossible to DROP at use. The lint rules
 * named above are what cover the second.
 */
export type Cited<T> = {
  readonly value: T;
  readonly citation: Citation;
};

/**
 * THE SIX RENDERS, AND WHY `kind` CARRIES THE NA REASON.
 * `enums.ts:44-48` is explicit: a null `value` with a null `na_reason` is
 * "NOT YET EXTRACTED" — a fifth, distinct render, and NOT a member of
 * `NaReason`. It is a statement about the PIPELINE; the four NA reasons are
 * statements about the DOCUMENT. `INVARIANTS:37` and `:45-46` forbid
 * collapsing them and forbid keying anything off `value === null`.
 * THE UNION IS FLAT, AND THAT IS THE WHOLE POINT. It used to carry a single
 * `{ kind: "na"; reason: NaReason }` branch, and REVIEW-01 (B2) proved that
 * the exact collapse the rulebook forbids compiled clean under it:
 *     case "na": return <span>—</span>;   // ALL FOUR, ONE GREY DASH
 * The `never` guard was satisfied, because `kind` had four members and all
 * four NA reasons hid inside one of them. Adding a fifth `NaReason` would
 * likewise have broken no site, because no site switched over `NaReason`.
 * So the reason is lifted INTO the discriminant. A `switch` over `kind` with
 * the `never` guard below now cannot compile while any one of the six is
 * unhandled, and a fifth NA reason breaks every site that must learn about
 * it. That is what the previous version of this paragraph claimed and did not
 * do.
 * The OTHER real guarantee in this area is not here: `entities/field/
 * noValueStates.ts:42` is a `Record<NoValueRender, …>` over the same five
 * no-value renders, so a fifth NA reason fails to compile there too, and
 * `noValueStates.test.ts` asserts the five differ in every channel. That file
 * owns the rendering taxonomy. This one only classifies what arrived.
 * `uncited` is the sixth member and the reason the type exists at all: the
 * server CAN send a value with no source. That is not a render bug to paper
 * over — `entities.ts:85-89` calls it the failure the architecture exists to
 * catch. It gets its own branch so a screen must show it as the defect it is.
 * `PRESENT_UNREADABLE` is "the only member that carries a page reference"
 * (`enums.ts:41-43`), so it is the only NA branch whose citation can be
 * non-null — and now the TYPE says so, rather than a comment. The other three
 * carry no citation field at all, so a component cannot render one on them by
 * accident.
 */
export type FieldValue =
  | { readonly kind: "cited"; readonly cited: Cited<string> }
  | { readonly kind: "uncited"; readonly value: string }
  | { readonly kind: "not-extracted" }
  | { readonly kind: "na-not-present" }
  | { readonly kind: "na-not-found" }
  | { readonly kind: "na-not-stated" }
  | { readonly kind: "na-present-unreadable"; readonly citation: Citation | null };

/**
 * The contract's `NaReason` spelled as this union's discriminants. A `Record`
 * over the frozen enum, so a fifth member fails to compile HERE — one place —
 * rather than silently classifying as something else.
 */
export const NA_KIND: Readonly<Record<NaReason, NaFieldValueKind>> = {
  NOT_PRESENT: "na-not-present",
  NOT_FOUND: "na-not-found",
  NOT_STATED: "na-not-stated",
  PRESENT_UNREADABLE: "na-present-unreadable",
};

type NaFieldValueKind = Extract<FieldValue, { kind: `na-${string}` }>["kind"];

/**
 * An `NaReason` as its `FieldValue` member. The one supported way to go from
 * the frozen enum to this union.
 * It exists so a caller that legitimately iterates `NaReason.options` — the
 * states gallery is the case, and it is a good one, because a fifth reason
 * should appear on that canvas the day it is added — does not have to hardcode
 * four literals and go stale. Consumption still switches over `kind`, so the
 * B2 guarantee is untouched: this widens construction, never rendering.
 */
export function naFieldValue(
  reason: NaReason,
  citation: Citation | null,
): FieldValue {
  const kind = NA_KIND[reason];
  return kind === "na-present-unreadable" ? { kind, citation } : { kind };
}

/**
 * The exhaustiveness guard. `tsconfig.app.json` turns this into a compile
 * error rather than a silent fallthrough (BRIEF §6: "unions exhaustive with a
 * never guard").
 * Use it as the `default` of every switch over `FieldValue["kind"]` and over
 * `NaReason`. Adding a sixth render, or a fifth NA reason, then fails to
 * compile at every site that must learn about it — which is the point.
 */
export function assertNever(x: never, context: string): never {
  throw new Error(`${context}: unhandled member ${JSON.stringify(x)}`);
}
