/**
 * THE PROVENANCE ENVELOPE, AS A TYPE — AND WHAT THAT DOES NOT BUY.
 *
 * Hard rule (AGENTS.md): "Never emit a value you can't cite. Provenance on
 * everything (principle 6 — caught 6 times in prototyping)."
 *
 * Six times. That is the argument for this file. A rule caught six times in
 * review is a rule review does not catch; it is a rule that needs a mechanism.
 * `entities.ts:85-89` says the same thing from the server's side — a non-null
 * value with null `source_*` is "the exact failure shape the architecture
 * exists to catch".
 *
 * WHAT THIS FILE ACTUALLY ENFORCES, AND WHAT IT DOES NOT. Read this before
 * relying on it; the previous version of this paragraph claimed a compiler
 * guarantee that REVIEW-01 (B1) proved false in three ways, all of which
 * compiled clean:
 *
 *   1. `field.value` printed directly from the contract type, bypassing
 *      `readCited` entirely.
 *   2. `v.cited.value` destructured out, yielding a bare `string` with no
 *      residual obligation.
 *   3. a ternary laundering it into a plain `string`.
 *
 * `tsc` cannot close any of the three. `Cited<T>` is a structural record with
 * a public `value`, and TypeScript has no way to make reading a member an
 * error. Branding was evaluated and REJECTED: `string & { readonly __cited:
 * unique symbol }` is a SUBTYPE of `string`, so `const s: string = c.value`
 * still compiles — it closes construction, which was never the hole, and
 * costs a cast at every site that builds one. It makes the file worse for no
 * coverage. (Proof: `src/__probe/brand.tsx` in the B1 working notes.)
 *
 * So the honest statement is this. `readCited` + `FieldValue` are the shape a
 * component SHOULD print from, and it is a LINT rule, not the type system,
 * that stops the bypass:
 *
 *   - `eslint.config.js` `no-restricted-syntax` bans `field.value` member
 *     access outside this file.
 *   - `scripts/check-rules.mjs` (`raw-field-value`) carries the half ESLint
 *     cannot: any file importing `Field` from `@titlepipe/contract`, other
 *     than this one, may not touch `.value` at all.
 *
 * Both are grep-and-AST rules with the usual limits of such rules. They catch
 * the spelling a tired developer reaches for. They are not an adversary
 * model. The failure moves from a reviewer's attention to CI — not to `tsc`.
 *
 * WHAT THIS FILE IS NOT. It does not re-derive, re-validate, or second-guess
 * the server. `readCited` reads what the server sent and classifies it; it
 * never decides. Every branch below is a statement the SERVER already made —
 * this only refuses to let a component ignore one.
 */

import type { Field, NaReason } from "@titlepipe/contract";

/** A citation. Both members present, or this is not a citation. */
export type Citation = {
  readonly docId: string;
  readonly page: number;
  readonly snippet: string | null;
};

/**
 * A value that carries its source. The ONLY shape a component may print a
 * field value from.
 *
 * `Cited<T>` is deliberately not `{ value: T; citation?: Citation }` — an
 * optional citation is a citation you can forget.
 *
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
 *
 * `enums.ts:44-48` is explicit: a null `value` with a null `na_reason` is
 * "NOT YET EXTRACTED" — a fifth, distinct render, and NOT a member of
 * `NaReason`. It is a statement about the PIPELINE; the four NA reasons are
 * statements about the DOCUMENT. `INVARIANTS:37` and `:45-46` forbid
 * collapsing them and forbid keying anything off `value === null`.
 *
 * THE UNION IS FLAT, AND THAT IS THE WHOLE POINT. It used to carry a single
 * `{ kind: "na"; reason: NaReason }` branch, and REVIEW-01 (B2) proved that
 * the exact collapse the rulebook forbids compiled clean under it:
 *
 *     case "na": return <span>—</span>;   // ALL FOUR, ONE GREY DASH
 *
 * The `never` guard was satisfied, because `kind` had four members and all
 * four NA reasons hid inside one of them. Adding a fifth `NaReason` would
 * likewise have broken no site, because no site switched over `NaReason`.
 *
 * So the reason is lifted INTO the discriminant. A `switch` over `kind` with
 * the `never` guard below now cannot compile while any one of the six is
 * unhandled, and a fifth NA reason breaks every site that must learn about
 * it. That is what the previous version of this paragraph claimed and did not
 * do.
 *
 * The OTHER real guarantee in this area is not here: `entities/field/
 * noValueStates.ts:42` is a `Record<NoValueRender, …>` over the same five
 * no-value renders, so a fifth NA reason fails to compile there too, and
 * `noValueStates.test.ts` asserts the five differ in every channel. That file
 * owns the rendering taxonomy. This one only classifies what arrived.
 *
 * `uncited` is the sixth member and the reason the type exists at all: the
 * server CAN send a value with no source. That is not a render bug to paper
 * over — `entities.ts:85-89` calls it the failure the architecture exists to
 * catch. It gets its own branch so a screen must show it as the defect it is.
 *
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
const NA_KIND: Readonly<Record<NaReason, NaFieldValueKind>> = {
  NOT_PRESENT: "na-not-present",
  NOT_FOUND: "na-not-found",
  NOT_STATED: "na-not-stated",
  PRESENT_UNREADABLE: "na-present-unreadable",
};

type NaFieldValueKind = Extract<FieldValue, { kind: `na-${string}` }>["kind"];

/**
 * An `NaReason` as its `FieldValue` member. The one supported way to go from
 * the frozen enum to this union.
 *
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
 * Read a server field into the five-way union. A pure classification of what
 * arrived — no thresholds, no confidence, no derivation.
 *
 * Order matters, and the order encodes the rulebook:
 *
 * 1. `na_reason` FIRST. It is the server's positive statement about the
 *    document, and it outranks the value being null. Reading `value` first
 *    would fold all four NA reasons into "not extracted", which is the exact
 *    collapse the rulebook forbids twice.
 * 2. Then null `value` — the pipeline statement.
 * 3. Then the citation test, which decides cited vs uncited.
 *
 * `PRESENT_UNREADABLE` is "the only member that carries a page reference"
 * (`enums.ts:41-43`), so it is the only NA branch that reads a citation. The
 * other three do not have the field.
 */
export function readCited(field: Field): FieldValue {
  if (field.na_reason !== null) {
    const kind = NA_KIND[field.na_reason];
    return kind === "na-present-unreadable"
      ? { kind, citation: toCitation(field) }
      : { kind };
  }

  if (field.value === null) {
    return { kind: "not-extracted" };
  }

  const citation = toCitation(field);
  return citation === null
    ? { kind: "uncited", value: field.value }
    : { kind: "cited", cited: { value: field.value, citation } };
}

/**
 * A citation, or null. Both `source_doc_id` and `source_page` must be present:
 * a document with no page cannot be pointed at, and a page with no document is
 * not a location. Half a citation is not a weaker citation, it is none.
 */
function toCitation(field: Field): Citation | null {
  if (field.source_doc_id === null || field.source_page === null) return null;
  return {
    docId: field.source_doc_id,
    page: field.source_page,
    snippet: field.source_snippet,
  };
}

/**
 * The exhaustiveness guard. `tsconfig.app.json` turns this into a compile
 * error rather than a silent fallthrough (BRIEF §6: "unions exhaustive with a
 * never guard").
 *
 * Use it as the `default` of every switch over `FieldValue["kind"]` and over
 * `NaReason`. Adding a sixth render, or a fifth NA reason, then fails to
 * compile at every site that must learn about it — which is the point.
 */
export function assertNever(x: never, context: string): never {
  throw new Error(`${context}: unhandled member ${JSON.stringify(x)}`);
}
