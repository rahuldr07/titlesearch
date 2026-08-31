/**
 * The shape of a cited value, and the six renders. This file is the
 * vocabulary; `provenance.ts` is the classifier that reads a server field
 * into it. Types here, decisions there.
 */

import type { NaReason } from "@titlepipe/contract";

/** A citation. Both members present, or this is not a citation. */
export type Citation = {
  readonly docId: string;
  readonly page: number;
  readonly snippet: string | null;
};

/**
 * A value that carries its source — the only shape a component may print a
 * field value from. The required citation makes it impossible to omit at
 * construction; the lint rules in `provenance.ts`'s header cover dropping it
 * at use.
 */
export type Cited<T> = {
  readonly value: T;
  readonly citation: Citation;
};

/**
 * The six renders. A null `value` with a null `na_reason` is "not yet
 * extracted" — a pipeline statement, distinct from the four NA reasons, which
 * are statements about the document; never collapse them and never key off
 * `value === null`. The NA reason is lifted into the discriminant so a switch
 * with the `assertNever` guard cannot compile while any of the six is
 * unhandled. `uncited` exists because the server can send a value with no
 * source — a screen must show that as the defect it is. `PRESENT_UNREADABLE`
 * is the only NA member that carries a page reference, so it is the only NA
 * branch with a citation field.
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
 * over the frozen enum, so a fifth member fails to compile here — one place —
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
 * An `NaReason` as its `FieldValue` member — the one supported way to go from
 * the frozen enum to this union, for callers that legitimately iterate
 * `NaReason.options`. Consumption still switches over `kind`.
 */
export function naFieldValue(
  reason: NaReason,
  citation: Citation | null,
): FieldValue {
  const kind = NA_KIND[reason];
  return kind === "na-present-unreadable" ? { kind, citation } : { kind };
}

/**
 * The exhaustiveness guard. Use as the `default` of every switch over
 * `FieldValue["kind"]` and over `NaReason`, so adding a member fails to
 * compile at every site that must learn about it.
 */
export function assertNever(x: never, context: string): never {
  throw new Error(`${context}: unhandled member ${JSON.stringify(x)}`);
}
