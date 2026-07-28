/**
 * The product baseline this screen resolves against, and the intake prefill.
 *
 * CONTRACT GAP: there is no clients, products or config endpoint —
 * `packages/contract` carries no schema for any of it and `packages/mocks`
 * serves none of it. The intake config layer is still open, so this file is a
 * FIXTURE standing in for the server's baseline rather than a locally-widened
 * contract type.
 *
 * The baseline is duplicated here rather than imported from the products
 * feature on purpose: features do not reach into each other, and when this
 * layer gets a contract both copies collapse into one parsed response.
 */

export interface BaselineLine {
  n: number;
  label: string;
  /**
   * A line the product's MEANING depends on. Waiving one is not a preference —
   * it changes what the search claims to have covered, which is why waiving it
   * raises a conflict a person has to acknowledge on the record.
   */
  loadBearing: boolean;
}

/** The 40-Year baseline: every line applies, nothing narrowed at the product level. */
export const BASELINE_LINES: readonly BaselineLine[] = [
  { n: 1, label: "Taxes and assessors pulled for all parcels", loadBearing: true },
  { n: 2, label: "Name search and GI run for all names", loadBearing: false },
  { n: 3, label: "Vesting deed names match per customer", loadBearing: false },
  { n: 4, label: "Full Value Deed found", loadBearing: false },
  { n: 5, label: "FVD covers PIQ; legal description page included", loadBearing: false },
  { n: 6, label: "Deed chain complete", loadBearing: true },
  { n: 7, label: "All open mortgages and related documents considered", loadBearing: true },
  { n: 8, label: "Mortgage covering additional property: assessor + taxes", loadBearing: false },
  { n: 9, label: "All liens and UCC per standard criteria", loadBearing: false },
  { n: 10, label: "More than 10 judgments: first 10 listed, standard comment", loadBearing: false },
  { n: 11, label: "Plat map, or tax/GIS map, included", loadBearing: false },
  { n: 12, label: "Merging sequence followed", loadBearing: false },
  { n: 13, label: "Name search, judgment and UCC indexes provided", loadBearing: false },
];

export const lineNumber = (n: number): string => `L${String(n).padStart(2, "0")}`;

/**
 * Sign-off suggestion defaults — PREFILL ONLY.
 *
 * Sparse on purpose: anything not listed suggests YES. The abstractor still
 * answers every line, and the screen says so next to the grid, because a
 * prefilled checklist that nobody re-reads is a signature on assertions nobody
 * made.
 */
const SUGGESTED: Readonly<Record<number, string>> = { 8: "N/A" };

export const SIGNOFF_DEFAULTS = BASELINE_LINES.map((l) => ({
  key: lineNumber(l.n),
  label: `${lineNumber(l.n)} · ${l.label}`,
  value: SUGGESTED[l.n] ?? "YES",
}));
