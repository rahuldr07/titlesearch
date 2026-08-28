/**
 * The provenance envelope, as a type — and what that does not buy.
 * Hard rule (AGENTS.md): "Never emit a value you can't cite. Provenance on
 * everything (principle 6 — caught 6 times in prototyping)."
 * Six times. That is the argument for this file. A rule caught six times in
 * review is a rule review does not catch; it is a rule that needs a mechanism.
 * `entities.ts:85-89` says the same thing from the server's side — a non-null
 * value with null `source_*` is "the exact failure shape the architecture
 * exists to catch".
 * WHAT THIS FILE ACTUALLY ENFORCES, AND WHAT IT DOES NOT. Read this before
 * relying on it; the previous version of this paragraph claimed a compiler
 * guarantee that REVIEW-01 (B1) proved false in three ways, all of which
 * compiled clean:
 *   1. `field.value` printed directly from the contract type, bypassing
 *      `readCited` entirely.
 *   2. `v.cited.value` destructured out, yielding a bare `string` with no
 *      residual obligation.
 *   3. a ternary laundering it into a plain `string`.
 * `tsc` cannot close any of the three. `Cited<T>` is a structural record with
 * a public `value`, and TypeScript has no way to make reading a member an
 * error. Branding was evaluated and REJECTED: `string & { readonly __cited:
 * unique symbol }` is a SUBTYPE of `string`, so `const s: string = c.value`
 * still compiles — it closes construction, which was never the hole, and
 * costs a cast at every site that builds one. It makes the file worse for no
 * coverage. (Proof: `src/__probe/brand.tsx` in the B1 working notes.)
 * So the honest statement is this. `readCited` + `FieldValue` are the shape a
 * component SHOULD print from, and it is a LINT rule, not the type system,
 * that stops the bypass:
 *   - `eslint.config.js` `no-restricted-syntax` bans `field.value` member
 *     access outside this file.
 *   - `scripts/check-rules.mjs` (`raw-field-value`) carries the half ESLint
 *     cannot: any file importing `Field` from `@titlepipe/contract`, other
 *     than this one, may not touch `.value` at all.
 * Both are grep-and-AST rules with the usual limits of such rules. They catch
 * the spelling a tired developer reaches for. They are not an adversary
 * model. The failure moves from a reviewer's attention to CI — not to `tsc`.
 * WHAT THIS FILE IS NOT. It does not re-derive, re-validate, or second-guess
 * the server. `readCited` reads what the server sent and classifies it; it
 * never decides. Every branch below is a statement the SERVER already made —
 * this only refuses to let a component ignore one.
 */

import type { Field } from "@titlepipe/contract";
import type { Citation, FieldValue } from "./fieldValue";
import { NA_KIND } from "./fieldValue";

/*
 * The vocabulary lives in `fieldValue.ts` and is re-exported here so this
 * module stays the single import for anything provenance-related. The split is
 * the §6 length gate, not a boundary a caller needs to know about.
 */
export type { Citation, Cited, FieldValue } from "./fieldValue";
export { assertNever, naFieldValue } from "./fieldValue";

/**
 * Read a server field into the five-way union. A pure classification of what
 * arrived — no thresholds, no confidence, no derivation.
 * Order matters, and the order encodes the rulebook:
 * 1. `na_reason` FIRST. It is the server's positive statement about the
 *    document, and it outranks the value being null. Reading `value` first
 *    would fold all four NA reasons into "not extracted", which is the exact
 *    collapse the rulebook forbids twice.
 * 2. Then null `value` — the pipeline statement.
 * 3. Then the citation test, which decides cited vs uncited.
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
