import type { FieldReading } from "@titlepipe/contract";

/**
 * DID THE ENGINES DISAGREE? — a fact about the payload, never a ruling.
 *
 * INVARIANT 28: "engine disagreement is surfaced ON THE ROW, and both readings
 * shown attributed in the panel." This answers the first half.
 *
 * It compares the values the server SENT and stops there. It does not decide
 * which reading is right, does not weight by `confidence_raw` (documented
 * miscalibrated, `entities.ts:76`, "never a gate"), and does not conclude
 * anything about the field's state — the server already ruled on that and the
 * row prints its ruling.
 *
 * A null and a value ARE a disagreement, and deliberately so: `fld_j1atty` is
 * the fixture where "one reader found the line and the other returned nothing",
 * and INVARIANT 29 is explicit that such a field must never be rendered as
 * though extraction returned nothing at all.
 *
 * ══ WHY THIS IS ITS OWN FILE ═══════════════════════════════════════════════
 *
 * `check-rules.mjs` (`raw-field-value`) refuses `.value` in any file that
 * imports `Field` from the contract, because that is the bypass around
 * `readCited` that shipped six times. A READING is not a field — it has no
 * provenance envelope to bypass, `ReadingPair` prints it directly, and the
 * comparison has to touch `.value` to exist at all. Splitting it out keeps the
 * gate meaningful on the files it is actually protecting rather than earning
 * this one an exemption comment.
 */
export function readingsDisagree(readings: readonly FieldReading[]): boolean {
  if (readings.length < 2) return false;
  return new Set(readings.map((reading) => reading.value)).size > 1;
}

/**
 * The two readings the server nominated for the comparison, or null.
 *
 * `DecisionCard` takes a PAIR rather than the array, and its own header says
 * why: "PICKING two out of it here would be the UI deciding which engines are
 * in the comparison". So this takes the first two IN THE SERVER'S ORDER and
 * refuses to pick at all — if the server ever sends three, the honest answer is
 * that this shape cannot express it and the contract needs widening, not that
 * the browser should choose two.
 */
export function nominatedPair(
  readings: readonly FieldReading[],
): { readonly a: FieldReading; readonly b: FieldReading } | null {
  const [a, b] = readings;
  if (a === undefined || b === undefined) return null;
  return { a, b };
}
