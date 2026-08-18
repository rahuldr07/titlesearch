import type { Field } from "@titlepipe/contract";
import { hasNoProvenance, isExcluded } from "../../entities/field/fieldLabel";

/**
 * WHAT A ROW SHOULD SIGNAL, read from server `state` and the provenance
 * predicates — never from confidence, never from `value === null`.
 *
 * THREE TONES, NOT THREE SEVERITIES OF ONE THING. `halt`: the EVIDENCE failed —
 * a value with nothing behind it (principle 6) or a page seen and not readable.
 * Nobody decides those by reading harder; they go back to the package.
 * `attend`: a PERSON is owed, queued or escalated. `settled`: a record.
 *
 * `null` IS `pending` AND EXCLUDED — the pipeline has not looked, or the row is
 * off the sheet. Tinting either would say something happened that did not.
 *
 * HALT OUTRANKS ATTEND: a queued field whose only reading is illegible, drawn
 * amber beside eleven other amber rows, is one confirmed from the value alone.
 *
 * IT IS NOT `na_reason !== null`. Three of the four NA answers are ANSWERS a
 * reader established by looking; painting them as faults teaches a reviewer
 * that a correct absence is an error. Only the unreadable one is evidence
 * failing.
 *
 * IT LIVES IN ITS OWN MODULE, not on `reportSections`, because it is a rule
 * about ONE field and everything there is a rule about a GROUP of them.
 */
export function rowTone(field: Field): "halt" | "attend" | "settled" | null {
  if (isExcluded(field)) return null;
  if (hasNoProvenance(field) || field.na_reason === "PRESENT_UNREADABLE") return "halt";
  if (field.state === "needs_review" || field.state === "escalated") return "attend";
  if (field.state === "pending") return null;
  return "settled";
}
