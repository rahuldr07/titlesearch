import type { Field } from "@titlepipe/contract";

/** T1 — ruinous exposure, read off the server's `rule_refs`. */
const T1_PREFIX = "T1-";

export function isRuinous(field: Field): boolean {
  return field.rule_refs.some((ref) => ref.startsWith(T1_PREFIX));
}

/**
 * Coloured capsules appear only at moments of record, and T1 is one — the
 * only capsule the field list draws.
 */
export function T1Pill() {
  return (
    /* Accent violet — action ink on the action surface — not halt red. */
    <span
      data-testid="t1-pill"
      title="Ruinous exposure — a second examiner must countersign this ruling before release."
      className="inline-flex items-center rounded-pill border border-action-border bg-action-surface px-4 font-mono text-label leading-flat font-bold text-action"
    >
      T1
    </span>
  );
}
