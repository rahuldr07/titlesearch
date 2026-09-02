import type { FieldReading } from "@titlepipe/contract";

/**
 * WHAT THE SERVER ACTUALLY SENDS, AND WHY THIS FILE REFUSES THINGS.
 *
 * `Field.readings` is `z.array(FieldReading)` — "All engines' pre-merge
 * values" (contract/src/entities.ts:119). It is NOT a nominated pair:
 *
 *   - Nothing bounds it at two. `services/core-api` has no readings query,
 *     serializer, or endpoint at all — `field_readings` exists only as a
 *     skeleton table (db/models.py:296-312, migration 0001 line 292) with no
 *     unique constraint on `(field_id, engine_id)` and no nomination column.
 *     There is no server-side nomination to trust yet.
 *   - Two readings can carry the SAME `engine_id`: "A value spanning two lines
 *     has two readings, each with its own box" (entities.ts:25). One engine,
 *     two line fragments of one value.
 *
 * So the array's CARDINALITY carries no domain claim, and neither does its
 * ORDER. A comparison between two engines exists only where the payload
 * actually contains one — exactly two readings from two distinct engines.
 * Anywhere else this module says so and stops, because the alternatives are
 * both defects the UI is not allowed to commit: calling two fragments of one
 * engine's reading a disagreement (a ruling the server never made), or
 * showing the first two of three and dropping the rest (a silent edit of the
 * evidence). Server owns all state machines — AGENTS.md.
 */

/**
 * What the payload supports, decided once so the row chip and the panel can
 * never contradict each other — they read the same verdict rather than each
 * inspecting the array.
 *
 * - `none` — nothing to compare (0 or 1 reading).
 * - `pair` — exactly two readings, two distinct engines. `disagree` is then a
 *   fact about the payload: the two engines returned different values.
 * - `not-comparable` — readings exist but do not form a two-engine
 *   comparison: more than two of them, or two from one engine. Neither a
 *   disagreement nor an agreement is claimed, and nothing is dropped; the
 *   panel surfaces the count so the reviewer knows readings are being held.
 */
export type ReadingComparison =
  | { readonly kind: "none" }
  | {
      readonly kind: "pair";
      readonly a: FieldReading;
      readonly b: FieldReading;
      readonly disagree: boolean;
    }
  | {
      readonly kind: "not-comparable";
      readonly readings: readonly FieldReading[];
      readonly engines: number;
    };

export function readingComparison(
  readings: readonly FieldReading[],
): ReadingComparison {
  if (readings.length < 2) return { kind: "none" };

  const engines = new Set(readings.map((reading) => reading.engine_id)).size;
  const [a, b] = readings;

  // `engines === 2` with `length === 2` is the only shape in which "A" and "B"
  // name two engines. `length === 2 && engines === 1` is one engine's two line
  // fragments — the false-A≠B case.
  if (readings.length === 2 && engines === 2 && a !== undefined && b !== undefined) {
    return { kind: "pair", a, b, disagree: a.value !== b.value };
  }

  return { kind: "not-comparable", readings, engines };
}

/**
 * Did two engines disagree? A fact about the payload, never a ruling — and
 * only askable where the payload holds a two-engine comparison. False for
 * `not-comparable` is not a claim that the engines agreed; it is the absence
 * of a claim, which is the only honest thing the UI can say there.
 */
export function readingsDisagree(readings: readonly FieldReading[]): boolean {
  const comparison = readingComparison(readings);
  return comparison.kind === "pair" && comparison.disagree;
}

/**
 * The two readings to draw side by side, or null.
 *
 * Guarantees to `ReadingPair` that `a.engine_id !== b.engine_id`. That is the
 * invariant its per-engine `data-testid` and its per-engine attribution both
 * stand on: two seats labelled with one engine id are two buttons a test
 * cannot tell apart, and an attribution that attributes nothing.
 */
export function nominatedPair(
  readings: readonly FieldReading[],
): { readonly a: FieldReading; readonly b: FieldReading } | null {
  const comparison = readingComparison(readings);
  if (comparison.kind !== "pair") return null;
  return { a: comparison.a, b: comparison.b };
}
