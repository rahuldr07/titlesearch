import type { SourcePage } from "@titlepipe/contract";

/**
 * A page that is obviously NOT a real instrument.
 *
 * Every line says so. A story fixture that looked like a genuine county record
 * is a screenshot away from being read as one — and this component's whole
 * argument is that a reviewer must treat what it draws as a document rather
 * than as data, which is exactly the reflex that makes a convincing fake
 * dangerous in a design review.
 *
 * It lives beside the entity rather than in the story so the story stays under
 * the file-length limit and so a second surface rendering a specimen page uses
 * this one instead of inventing another.
 */
export const SPECIMEN_PAGE: SourcePage = {
  n: 12,
  kind: "SPECIMEN INSTRUMENT",
  read_in_full: true,
  degraded: false,
  lines: [
    "SPECIMEN — SYNTHETIC FIXTURE, NOT A REAL INSTRUMENT",
    "COUNTY OF EXAMPLE            BOOK 00000  PAGE 000",
    "",
    "LENDER: SPECIMEN LENDING CO (FIXTURE)",
    "AMOUNT: $000,000.00",
  ],
};

/** One cited line, so the evidence mark is measured rather than assumed. */
export const SPECIMEN_BOXES = [{ x: 0.09, y: 0.55, width: 0.62, height: 0.05 }];
