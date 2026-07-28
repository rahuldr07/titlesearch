/**
 * The effective sign-off list for one order.
 *
 * WHY A LOCAL CONSTANT: this list is not a screen's opinion — the server
 * resolves it from a product baseline with the client's own waive / add /
 * narrow / replace overrides applied, and versions the result. None of that
 * exists yet. Rendering the design from a fixture shows the layout without
 * asserting a shape the backend has not agreed to, which is the alternative
 * that would have been wrong.
 *
 * CONTRACT GAP: no sign-off list endpoint. The effective product x client list,
 * its config version, the per-line N/A provenance, and the policy suggestion
 * are all server-owned and absent from `packages/contract` (intake config
 * layer, rulings Q4-Q10 — still open).
 *
 * Every value here is a placeholder for a 40-Year Search on a sample order.
 */

export type SignoffAnswer = "YES" | "NO" | "N/A";

export interface SignoffLine {
  readonly id: string;
  /** The line's position on the client's list, not an array index. */
  readonly n: number;
  readonly label: string;
  /** N/A is offered only where the line can genuinely fail to apply. */
  readonly answers: readonly SignoffAnswer[];
  /** A NO here cannot be handed over without a reason. */
  readonly commentOnNo: "required" | "optional";
  /**
   * What the client actually bought on this line. Shown beside the question
   * because "did you run the name search" means a different amount of work at
   * 40 years than at current-owner, and answering without the scope in view is
   * answering a different question.
   */
  readonly periodText: string | null;
  /**
   * False = no machine signal exists for this line at all, so an N/A can never
   * be checked against the package. Silence from a check that was never run is
   * indistinguishable from a check that passed, and the row says which it is.
   */
  readonly naVerified: boolean;
  /** The client's reviewed policy answer. A suggestion — never an answer. */
  readonly suggested: SignoffAnswer;
}

const YN: readonly SignoffAnswer[] = ["YES", "NO"];
const YNA: readonly SignoffAnswer[] = ["YES", "NO", "N/A"];

const PERIOD = "40-year period · 07/18/1986 – 07/18/2026";

export const SIGNOFF_LINES: readonly SignoffLine[] = [
  { id: "L01", n: 1, label: "Taxes and assessors pulled for all parcels",
    answers: YNA, commentOnNo: "required", periodText: null, naVerified: true, suggested: "YES" },
  { id: "L02", n: 2, label: "Name search and GI run for all names",
    answers: YN, commentOnNo: "required", periodText: `all names in the period · ${PERIOD}`,
    naVerified: true, suggested: "YES" },
  { id: "L03", n: 3, label: "Vesting deed names match per customer",
    answers: YN, commentOnNo: "required", periodText: null, naVerified: true, suggested: "YES" },
  { id: "L04", n: 4, label: "Full Value Deed found",
    answers: YNA, commentOnNo: "required", periodText: null, naVerified: false, suggested: "YES" },
  { id: "L05", n: 5, label: "FVD covers PIQ; legal description page included",
    answers: YN, commentOnNo: "required", periodText: null, naVerified: true, suggested: "YES" },
  { id: "L06", n: 6, label: "Deed chain complete",
    answers: YNA, commentOnNo: "required", periodText: `the full period · ${PERIOD}`,
    naVerified: true, suggested: "YES" },
  { id: "L07", n: 7, label: "All open mortgages and related documents considered",
    answers: YN, commentOnNo: "required", periodText: null, naVerified: true, suggested: "YES" },
  { id: "L08", n: 8, label: "Mortgage covering additional property: assessor + taxes",
    answers: YNA, commentOnNo: "optional", periodText: null, naVerified: true, suggested: "N/A" },
  { id: "L09", n: 9, label: "All liens and UCC per standard criteria",
    answers: YN, commentOnNo: "required", periodText: `all owners in the period · ${PERIOD}`,
    naVerified: true, suggested: "YES" },
  { id: "L10", n: 10, label: "More than 10 judgments: first 10 listed, standard comment",
    answers: YNA, commentOnNo: "optional", periodText: null, naVerified: false, suggested: "YES" },
  { id: "L11", n: 11, label: "Plat map, or tax/GIS map, included",
    answers: YNA, commentOnNo: "optional", periodText: null, naVerified: false, suggested: "YES" },
  { id: "L12", n: 12, label: "Merging sequence followed",
    answers: YN, commentOnNo: "required", periodText: null, naVerified: true, suggested: "YES" },
  { id: "L13", n: 13, label: "Name search, judgment and UCC indexes provided",
    answers: YN, commentOnNo: "required", periodText: null, naVerified: true, suggested: "YES" },
];

/** The one note that says why an unverifiable N/A is shown as unverifiable. */
export const NA_UNCHECKED_NOTE =
  "An N/A on this line is not verified against the package and raises no gate.";
