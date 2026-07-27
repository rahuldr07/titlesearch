/**
 * The capture seat's field roster — STATIC, and that is the point.
 *
 * `blind-blindness.spec` #1 asserts the typist screen issues ZERO `/api` GETs:
 * the only call that ever leaves it is the submit POST. So this roster cannot
 * be fetched. A GET would be a channel into the seat, and the whole design of
 * blind double-entry is that the second typist sees nothing — not the model's
 * output, not the other typist's answers, not a suggestion.
 *
 * Field ids are the contract's dotted paths (`mortgages.1.lender`), not the
 * design's short ids, because that is what the harvested specs address and
 * what the submit payload carries.
 *
 * `settled` values are what THIS typist already recorded in this session. They
 * are not pipeline output — nothing here comes from an engine.
 */
export interface BlindField {
  /** Dotted contract path. Doubles as the testid suffix. */
  id: string;
  label: string;
  /** A judgment TYPE takes a second pass and gates its siblings. */
  isType?: boolean;
  /** Opens only once its section's TYPE has been recorded. */
  gated?: boolean;
}

export interface BlindSection {
  /** Machine name, shown as drawn — the design labels sections this way. */
  name: string;
  /** Why this section is worth extra care. Never a score or a rate. */
  note?: string;
  fields: BlindField[];
}

export const BLIND_SECTIONS: readonly BlindSection[] = [
  {
    name: "mortgages",
    fields: [
      { id: "mortgages.1.lender", label: "MTG 1 — LENDER" },
      { id: "mortgages.1.amount", label: "MTG 1 — AMOUNT" },
      { id: "mortgages.1.dated_filed", label: "MTG 1 — DATED / FILED" },
      { id: "mortgages.2.lender", label: "MTG 2 — LENDER" },
      { id: "mortgages.2.book_page", label: "MTG 2 — BOOK/PAGE" },
    ],
  },
  {
    name: "vesting",
    fields: [
      { id: "vesting.grantee", label: "GRANTEE" },
      { id: "vesting.dated_filed", label: "DATED / FILED" },
      { id: "vesting.consideration", label: "CONSIDERATION" },
    ],
  },
  {
    name: "assessment",
    fields: [
      { id: "assessment.land_value", label: "LAND VALUE" },
      { id: "assessment.building_value", label: "BUILDING VALUE" },
      { id: "assessment.total_value", label: "TOTAL VALUE" },
    ],
  },
  {
    name: "judgments_liens",
    // Field-level, from the seed build. A statement about the DOCUMENTS, never
    // about the typist — there is no per-person accuracy anywhere in here.
    note: "3 of 7 known defects in delivered reports were in this section, and accuracy was lowest here during seed construction. Take extra time. Unclear-with-a-source is a better answer than a guess marked certain.",
    fields: [
      { id: "judgments.1.type", label: "JUDGMENT 1 — TYPE", isType: true },
      { id: "judgments.1.plaintiff", label: "JUDGMENT 1 — PLAINTIFF", gated: true },
      { id: "judgments.1.amount", label: "JUDGMENT 1 — AMOUNT", gated: true },
      { id: "judgments.1.attorney", label: "JUDGMENT 1 — ATTORNEY", gated: true },
    ],
  },
];

/** What a typist recorded for one field. Three parts, all required. */
export interface BlindEntry {
  path: string;
  value: string | null;
  na_reason: string | null;
  source_citation: string;
  confidence: "certain" | "unclear";
}
