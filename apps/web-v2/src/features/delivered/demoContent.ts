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

/**
 * The design's own strings, kept verbatim.
 *
 * They were previously replaced with self-labelling stand-ins ("Two-Owner Search
 * (demo)" / "demo · eff 07/18/2026"), and that lost the point of the pair: the
 * footnote below the artifact claims the sheet "states the product and period",
 * and a single effective date is not a period. The screen has to show a SPAN to
 * demonstrate the claim it makes about itself.
 *
 * Nothing is being passed off as real. The order id rendered two lines above is
 * `ord_demo_1` and the filename carries it, so the fixture is on its face; the
 * gap that matters is the one recorded above — the wire cannot say either of
 * these, and no amount of labelling fixes that.
 */
export const DEMO_PRODUCT_NAME = "40-Year Search";

/** Mono badge beside the product — the span the sheet covers, not one date. */
export const DEMO_PERIOD_BADGE = "40-year period · 07/18/1986 – 07/18/2026";

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
