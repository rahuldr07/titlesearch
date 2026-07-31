/**
 * A synthetic page raster for stories. Deliberately obviously fake — BRIEF §10
 * says to replace plausible-looking mock party names and addresses with
 * fixtures nobody could mistake for real data. Nothing here resembles a real
 * instrument, and no name in it belongs to a person.
 *
 * ON THE HARD-CODED COLOURS BELOW. `DocumentPane` takes `pageSrc: string`
 * because real source pages are rasters served by the backend, so the honest
 * stand-in is a data-URI image. A data URI has no CSS context: it cannot
 * reference `var(--color-page-ink)` or any other token, because the tokens
 * live in the host document's cascade and the SVG is a separate resource.
 *
 * These values therefore mirror the ink/paper tokens by hand. They are content
 * inside a fake photograph of a document — not styling of the application —
 * which is the distinction §6's rule is drawing. Each is marked `rules-allow:`
 * with that reason rather than the rule being loosened for everyone.
 */

const PAPER = "#fbfaf5"; // rules-allow: data-URI SVG has no CSS context; mirrors --color-surface-paper
const INK = "#232327"; // rules-allow: data-URI SVG has no CSS context; mirrors --color-page-ink
const SCAN_INK = "#2a2a2e"; // rules-allow: data-URI SVG has no CSS context; mirrors --color-scan-ink
const RULE_LINE = "#d5d0c0"; // rules-allow: data-URI SVG has no CSS context; mirrors --color-scan-line

const PAGE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792">
  <rect width="612" height="792" fill="${PAPER}"/>
  <text x="60" y="90" font-family="monospace" font-size="17" fill="${INK}">
    SPECIMEN — SYNTHETIC FIXTURE, NOT A REAL INSTRUMENT
  </text>
  <text x="60" y="130" font-family="monospace" font-size="13" fill="${SCAN_INK}">
    COUNTY OF EXAMPLE            BOOK 00000  PAGE 000
  </text>
  ${Array.from({ length: 18 }, (_, i) => {
    const y = 190 + i * 26;
    const w = 300 + ((i * 47) % 210);
    return `<rect x="60" y="${y}" width="${w}" height="9" fill="${RULE_LINE}"/>`;
  }).join("")}
  <text x="60" y="452" font-family="monospace" font-size="14" fill="${INK}">
    LENDER: SPECIMEN LENDING CO (FIXTURE)
  </text>
  <text x="60" y="486" font-family="monospace" font-size="14" fill="${INK}">
    AMOUNT: $000,000.00
  </text>
</svg>`.trim();

export const SYNTHETIC_PAGE_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(PAGE_SVG)}`;

/**
 * Boxes over the two lines that carry values, normalised 0..1 — the shape
 * `toEvidenceBoxes` produces. Positioned to match the SVG above.
 */
export const SYNTHETIC_BOXES = [
  { x: 0.09, y: 0.552, width: 0.62, height: 0.026 },
  { x: 0.09, y: 0.595, width: 0.38, height: 0.026 },
];
