/**
 * THE PROVENANCE ENVELOPE, AS A TYPE.
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
 * So the envelope stops being a convention and becomes a type. A component
 * cannot render a value without also holding its citation, because there is no
 * way to construct the argument. The failure moves from a reviewer's attention
 * to `tsc`.
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
 */
export type Cited<T> = {
  readonly value: T;
  readonly citation: Citation;
};

/**
 * THE FIVE RENDERS. Not four.
 *
 * `enums.ts:44-48` is explicit: a null `value` with a null `na_reason` is
 * "NOT YET EXTRACTED" — a fifth, distinct render, and NOT a member of
 * `NaReason`. It is a statement about the PIPELINE; the four NA reasons are
 * statements about the DOCUMENT. `INVARIANTS:37` and `:45-46` forbid
 * collapsing them and forbid keying anything off `value === null`.
 *
 * This union is what makes that structural. A `switch` over `kind` with the
 * `never` guard below cannot compile while one of the five is unhandled, so
 * "the four NA states must never collapse into one grey dash" is enforced by
 * the compiler rather than by a reviewer noticing a missing branch.
 *
 * `uncited` is the sixth member and the reason the type exists at all: the
 * server CAN send a value with no source. That is not a render bug to paper
 * over — `entities.ts:85-89` calls it the failure the architecture exists to
 * catch. It gets its own branch so a screen must show it as the defect it is.
 */
export type FieldValue =
  | { readonly kind: "cited"; readonly cited: Cited<string> }
  | { readonly kind: "uncited"; readonly value: string }
  | { readonly kind: "not-extracted" }
  | { readonly kind: "na"; readonly reason: NaReason; readonly citation: Citation | null };

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
 * (`enums.ts:41-43`), so an NA branch may hold a citation. The other three
 * carry null and the type says so.
 */
export function readCited(field: Field): FieldValue {
  if (field.na_reason !== null) {
    return {
      kind: "na",
      reason: field.na_reason,
      citation: toCitation(field),
    };
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
