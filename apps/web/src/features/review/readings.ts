import type { FieldReading } from "@titlepipe/contract";

/**
 * Did the engines disagree? A fact about the payload, never a ruling —
 * disagreement is surfaced on the row, and both readings shown attributed
 * in the panel. This answers the first half.
 */
export function readingsDisagree(readings: readonly FieldReading[]): boolean {
  if (readings.length < 2) return false;
  return new Set(readings.map((reading) => reading.value)).size > 1;
}

/**
 * The two readings the server nominated for the comparison, or null.
 * `DecisionCard` takes a pair rather than the array — picking two out of
 * it there would be the UI deciding which engines are in the comparison.
 */
export function nominatedPair(
  readings: readonly FieldReading[],
): { readonly a: FieldReading; readonly b: FieldReading } | null {
  const [a, b] = readings;
  if (a === undefined || b === undefined) return null;
  return { a, b };
}
