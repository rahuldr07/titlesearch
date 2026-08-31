import type { Field } from "@titlepipe/contract";

/** T1 — ruinous exposure, read off the server's `rule_refs`. */
const T1_PREFIX = "T1-";

export function isRuinous(field: Field): boolean {
  return field.rule_refs.some((ref) => ref.startsWith(T1_PREFIX));
}
