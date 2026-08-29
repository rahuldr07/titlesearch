import type { FieldReading } from "@titlepipe/contract";

/**

 * DID THE ENGINES DISAGREE? — a fact about the payload, never a ruling. INVARIANT 28:

 * "engine disagreement is surfaced ON THE ROW, and both readings shown attributed in

 * the panel." This answers the first half.

 */
export function readingsDisagree(readings: readonly FieldReading[]): boolean {
  if (readings.length < 2) return false;
  return new Set(readings.map((reading) => reading.value)).size > 1;
}

/**

 * The two readings the server nominated for the comparison, or null. `DecisionCard`

 * takes a PAIR rather than the array, and its own header says why: "PICKING two out of

 * it here would be the UI deciding which engines are in the comparison".

 */
export function nominatedPair(
  readings: readonly FieldReading[],
): { readonly a: FieldReading; readonly b: FieldReading } | null {
  const [a, b] = readings;
  if (a === undefined || b === undefined) return null;
  return { a, b };
}
