import type { Field, FieldReading, NaReason } from "@titlepipe/contract";

/**
 * A field's label is DERIVED FROM ITS PATH, not carried on the wire.
 *
 * The contract has no label, and inventing one server-side would make the same
 * field read differently in the report and on the screen. The abbreviations are
 * the report's own — a title abstract says MTG and JGMT — so a reviewer reading
 * a delivered report and a reviewer reading this screen are looking at the same
 * words.
 */
const SECTION_ABBR: Record<string, string> = { mortgages: "MTG", judgments: "JGMT" };

export function fieldLabel(path: string): string {
  const parts = path.split(".");
  const leaf = (parts[parts.length - 1] ?? path).replaceAll("_", " ").toUpperCase();
  const head = parts[0] ?? path;
  const index = parts.length === 3 ? parts[1] : undefined;
  const section = SECTION_ABBR[head] ?? head.toUpperCase();
  return index === undefined ? `${section} ${leaf}` : `${section} ${index} — ${leaf}`;
}

/**
 * THE FOUR NA STATES NEVER COLLAPSE (`review.spec` #1). Each says something
 * different about the DOCUMENT, and a reviewer needs to know which: an expected
 * absence is correct and quiet, while a present-but-unreadable field is a
 * degraded scan somebody has to look at.
 *
 * "Not Available" is what ships in the report for all four; the chip is what
 * separates them here. Collapsing to the shipped text alone would be exactly
 * the defect — the report cannot carry the distinction, so the screen must.
 */
export function naChip(reason: NaReason): string {
  switch (reason) {
    case "NOT_PRESENT":
      return "N/A — EXPECTED";
    case "NOT_FOUND":
      return "N/A — NOT FOUND";
    case "NOT_STATED":
      return "N/A — DOCUMENT SILENT";
    case "PRESENT_UNREADABLE":
      return "PRESENT — UNREADABLE";
  }
}

const STATE_LABEL: Record<Field["state"], string> = {
  pending: "PENDING",
  auto_confirmed: "AUTO-CONFIRMED",
  needs_review: "NEEDS REVIEW",
  confirmed: "CONFIRMED",
  corrected: "CORRECTED",
  escalated: "ESCALATED",
};

export function readingsOf(field: Field): FieldReading[] {
  return field.readings ?? [];
}

/** Two engines read it and returned different strings. */
export function enginesDisagree(field: Field): boolean {
  const values = readingsOf(field).map((reading) => reading.value);
  return values.length > 1 && new Set(values).size > 1;
}

/**
 * The state pill. THE SERVER OWNS `state` — engine confidence never promotes or
 * demotes anything here (`server-owns-state.spec` #2). A 0.99 field stays queued
 * if the server queued it, and a 0.01 field stays auto-confirmed if the server
 * confirmed it. The only thing this function adds is naming the two situations
 * the enum cannot express on its own: which NA state, and the unsettled case
 * where the engines disagreed and nothing was merged.
 */
export function isExcluded(field: Field): boolean {
  return (field.excluded_reason ?? null) !== null;
}

export function stateLabel(field: Field): string {
  if (isExcluded(field)) return "EXCLUDED — NOT OUR PARTY";
  if (field.na_reason !== null) return naChip(field.na_reason);
  if (field.value === null && enginesDisagree(field)) {
    return "ENGINES DISAGREE — NOTHING SETTLED";
  }
  return STATE_LABEL[field.state];
}

/**
 * The row's mark — present ONLY for states a human put the field into. An
 * auto-confirmed field carries no mark because nobody decided it, and marking
 * it would make the screen unable to answer the one question a complaint
 * investigation always asks: did a person see this?
 */
export function rowMark(field: Field): string | null {
  if (isExcluded(field)) return "✕ excluded";
  switch (field.state) {
    case "corrected":
      return "✎ corrected";
    case "escalated":
      return "↗ escalated";
    case "confirmed":
      return field.value === null ? "✓ accepted N/A" : "✓ confirmed";
    default:
      return null;
  }
}

/**
 * NEVER EMIT A VALUE YOU CANNOT CITE (principle 6). A value with no document,
 * no page and no reading behind it is not a fact — it is a string of unknown
 * origin sitting in a report, and it renders as a visible error rather than as
 * an ordinary value (`review.spec` #2).
 */
export function hasNoProvenance(field: Field): boolean {
  return (
    field.value !== null &&
    field.source_doc_id === null &&
    field.source_page === null &&
    readingsOf(field).length === 0
  );
}
