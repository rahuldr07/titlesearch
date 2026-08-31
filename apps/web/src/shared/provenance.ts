/**
 * The provenance envelope. `readCited` + `FieldValue` are the shape a
 * component should print from; the type system cannot stop a `.value` bypass,
 * so lint carries it: `eslint.config.js` (`no-restricted-syntax`) bans
 * `field.value` member access outside this file, and `scripts/check-rules.mjs`
 * (`raw-field-value`) bans `.value` in any other file importing `Field`.
 * This file never re-derives or second-guesses the server — every branch
 * below is a statement the server already made.
 */

import type { Field } from "@titlepipe/contract";
import type { Citation, FieldValue } from "./fieldValue";
import { NA_KIND } from "./fieldValue";

/*
 * The vocabulary lives in `fieldValue.ts` and is re-exported here so this
 * module stays the single import for anything provenance-related.
 */
export type { Citation, FieldValue } from "./fieldValue";
export { assertNever, naFieldValue } from "./fieldValue";

/**
 * Read a server field into the union. Order matters: `na_reason` first — the
 * server's positive statement about the document outranks the value being
 * null, and reading `value` first would fold all four NA reasons into "not
 * extracted". Then null `value` (the pipeline statement), then the citation
 * test. `PRESENT_UNREADABLE` is the only NA branch that reads a citation;
 * the other three do not have the field.
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
 * A citation, or null. Both `source_doc_id` and `source_page` must be
 * present — half a citation is not a weaker citation, it is none.
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
 * The value a confirm files. Confirm means "the machine read this correctly",
 * so the act names the value it confirms; sending null made the server compare
 * null against a real string and refuse falsely. Absent stays null — there is
 * nothing to confirm.
 */
export function confirmValue(field: Field): string | null {
  const value = readCited(field);
  if (value.kind === "cited") return value.cited.value;
  if (value.kind === "uncited") return value.value;
  return null;
}
