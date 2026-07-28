/**
 * ⚠ NONE OF THIS IS SERVER DATA. Every constant below is a stand-in kept in one
 * place so it is obvious what the screen invents and what it receives.
 *
 * CONTRACT GAP — the ordered PRODUCT and the search PERIOD.
 *   `DeliveriesResponse` carries id / method / status / timestamps plus the
 *   report's order id and version. It carries nothing about WHAT WAS ORDERED,
 *   and the delivered sheet's own copy says the product and period are printed
 *   on it. A delivery confirmation that cannot name the product is confirming
 *   an unnamed thing. Needs `product` and `period` on the report, or an order
 *   endpoint the screen can join against.
 *
 * CONTRACT GAP — the rendered ARTIFACT.
 *   There is no endpoint that returns, names, or serves the .docx. The filename
 *   below is composed from the order id, which is a GUESS at the server's naming
 *   and must not survive: a client that constructs a download URL from a
 *   convention will keep constructing it after the convention changes. Needs the
 *   report to carry its artifact's name and href.
 *
 * CONTRACT GAP — the amended-sheet DIFF.
 *   `report.version` says a v2 exists. Nothing says which fields were reworked
 *   or what they held in v1, so the per-field before/after below is fabricated.
 *   This is the one that matters most: the diff is the client-facing record of
 *   what was got wrong, and inventing it client-side would be inventing that
 *   record. The screen must not ship to a client until the server owns it.
 */

/** Marked in the copy itself so a screenshot cannot be mistaken for a real order. */
export const DEMO_PRODUCT_NAME = "Two-Owner Search (demo)";

/** Mono badge beside the product. Uppercased by `Chip`. */
export const DEMO_PERIOD_BADGE = "demo · eff 07/18/2026";

/** The server names its own artifacts; this convention is a placeholder. */
export function demoArtifactName(orderId: string): string {
  return `${orderId}_CallBackSheet.docx`;
}

/** The single reworked field the design draws. Fabricated — see the gap above. */
export const DEMO_AMENDED_FIELD = {
  label: "Vested Owner",
  v1: "MARIA L. ESTRADA (demo)",
  v2: "MARIA I. ESTRADA (demo)",
} as const;

/** The design's own history line. Fabricated; the timeline endpoint owns this. */
export const DEMO_ORDER_HISTORY =
  "Order history: v1 delivered 07/24 · disputed · v2 reissued 07/24 · R. Delacroix";
