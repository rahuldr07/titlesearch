/**
 * The gaps the completeness gate raised: an intake claim on one side, what was
 * actually segmented on the other.
 *
 * A GAP IS A DISAGREEMENT, NOT A VERDICT. Each card states the person's claim
 * and the machine's finding as two separate lines and does not decide between
 * them — because the machine is wrong often enough that a screen which assumed
 * otherwise would train people to amend true answers.
 *
 * CONTRACT GAP: no completeness-gate endpoint. `packages/contract` has no gate,
 * gap, or run resource; nothing serves the raised gaps, the machine checks
 * behind them, their provenance, or the closures below. Everything here is a
 * placeholder for a sample 40-Year Search.
 */

export interface Gap {
  readonly id: string;
  readonly title: string;
  readonly openStatusLabel: string;
  readonly claimText: string;
  readonly foundText: string;
  /**
   * Set where the check that raised this card cannot be trusted yet. Stating it
   * on the card is the only honest option: a gate that halts a run on evidence
   * it cannot vouch for must say so, or people learn to trust it anyway.
   */
  readonly provisionalNote: string | null;
  /** The answer this gap contradicts. Null where the ordered period is short. */
  readonly answeredAs: "YES" | "N/A" | null;
  readonly amend: { readonly label: string; readonly sub: string } | null;
  /** The period gap's two alternatives: assert the root, or change the product. */
  readonly periodAlternatives: boolean;
  readonly docName: string;
  readonly docPages: number;
}

export const PRODUCT_NAME = "40-Year Search";
export const PERIOD_BADGE = "40-year period · 07/18/1986 – 07/18/2026";
export const PACKAGE_PAGES = 64;

export const GAPS: readonly Gap[] = [
  {
    id: "L01",
    title: "Sign-off line 1 · Taxes and assessors pulled for all parcels",
    openStatusLabel: "Gap · answered N/A",
    claimText: "You answered N/A to sign-off line 1.",
    foundText:
      "The package shows three parcels — the precondition applies, so the line should have been answered.",
    provisionalNote:
      'Provisional — the precondition behind this gate ("three parcels") is a fixture on the build, not a value segmentation produced. It reads the same on every package, so this card cannot yet be trusted as evidence about THIS order.',
    answeredAs: "N/A",
    amend: {
      label: "Change answer: N/A → answer it",
      sub: "The precondition applies — re-answer the line. This is recorded.",
    },
    periodAlternatives: false,
    docName: "sample_tax_cert.pdf",
    docPages: 2,
  },
  {
    id: "L09",
    title: "Sign-off line 9 · All liens and UCC per standard criteria",
    openStatusLabel: "Gap · answered YES",
    claimText: "You answered YES to sign-off line 9.",
    foundText:
      "The machine checked the package for the same line and disagrees: Lien/UCC index result segmented — none found in the 64 pages.",
    provisionalNote: null,
    answeredAs: "YES",
    amend: {
      label: "Amend claim: YES → NO",
      sub: "Changes a signed assertion. This will be recorded.",
    },
    periodAlternatives: false,
    docName: "sample_ucc_index.pdf",
    docPages: 3,
  },
  {
    id: "L06",
    title: "Sign-off line 6 · Deed chain complete",
    openStatusLabel: "Gap · ordered period",
    claimText:
      "This order is a 40-Year Search — line 6 requires the search abstracted back to 07/18/1986.",
    foundText:
      "The earliest instrument segmented is dated 03/14/2011 — only a 15-year span.",
    provisionalNote: null,
    answeredAs: null,
    amend: null,
    periodAlternatives: true,
    docName: "sample_prior_chain.pdf",
    docPages: 6,
  },
];

/** Every other live product. Changing to one of these is what costs money. */
export const PRODUCT_CHANGE_OPTIONS: readonly string[] = [
  "Current Owner Search",
  "Two-Owner Search",
  "Update Search",
  "20-Year Search",
  "60-Year Search",
];

export const ROOT_PLACEHOLDER =
  "Why is this the root? e.g. Prior instrument is the patent from the United States, 03/1908 — nothing older of record.";

/** No `Date` anywhere in this app; a recorded moment is a server value. */
export const RECORDED_WHEN = "07/24/2026 14:12";
