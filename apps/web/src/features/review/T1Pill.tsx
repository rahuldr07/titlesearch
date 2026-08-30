import type { Field } from "@titlepipe/contract";

/**

 * T1 — ruinous exposure, and the countersign that has no contract. The design draws

 * two T1 things on this screen (§Screens 7): 1.

 */
const T1_PREFIX = "T1-";

export function isRuinous(field: Field): boolean {
  return field.rule_refs.some((ref) => ref.startsWith(T1_PREFIX));
}

/**

 * Rule 6: "colored capsules only at moments of record (released, quarantine clear,

 * T1)". This is one of the three, so it is a capsule — and it is the only capsule the

 * field list draws.

 */
export function T1Pill() {
  return (
    /* The drawn chip register (RULING-2026-08-29): the reference sets T1 in
       the accent violet — action ink on the action surface — not in halt red. */
    <span
      data-testid="t1-pill"
      title="Ruinous exposure — a second examiner must countersign this ruling before release."
      className="inline-flex items-center rounded-pill border border-action-border bg-action-surface px-4 font-mono text-label leading-flat font-bold text-action"
    >
      T1
    </span>
  );
}
