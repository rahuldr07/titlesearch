/**
 * WHY A RULING IS HELD, IN ONE SENTENCE PER CAUSE.
 *
 * `endpoints.ts:345-348`, verbatim: "POST /api/reconciliation/{order} — A
 * RULING WITH NO SOURCE IS AN OPINION. Citation is required. A general rule may
 * be offered by the senior (never pre-selected by the UI) and lands PENDING."
 *
 * `null` means live. That inverted convention is `components/ui/disabled.ts`'s
 * — the kit has no boolean disabled prop, so a REASON is the disablement.
 *
 * ══ THESE ARE HOLDS, NOT THE SERVER'S REFUSALS ═════════════════════════════
 *
 * `INVARIANTS:14` governs what comes BACK from a request; these say why one is
 * not being SENT, which only the client can know. Phrased as "Held: …" so a
 * reader can tell them from the server's sentence in the toast. Every one is
 * also enforced at handlers.ts:1295 (422 from `citation: z.string().min(1)`) —
 * the form states the reason early; the server is the enforcement.
 */

/**
 * Which value the senior is ruling for. Four members, and the fourth is the one
 * a "pick A or B" control would lose: `ruling_value` is NULLABLE
 * (endpoints.ts:351), so "neither reading is right" is a RULING the contract
 * can express, not a refusal to rule. Rule 14 — absence is typed, never blank.
 */
export type ValueChoice = "a" | "b" | "other" | "none";

/**
 * Narrow the radio's string back to the union. A `as ValueChoice` cast would
 * typecheck and would also launder a renamed radio value into a choice the
 * `rulingValue` switch does not handle; this returns `null` instead, which the
 * card already renders as "nothing chosen yet".
 */
export function asChoice(value: string): ValueChoice | null {
  return value === "a" || value === "b" || value === "other" || value === "none"
    ? value
    : null;
}

export function rulingHold(
  choice: ValueChoice,
  typed: string,
  citation: string,
  offersRule: boolean,
  draft: string,
): string | null {
  if (choice === "other" && typed.trim().length === 0) {
    return "Held: you chose a third value and typed none. Say what the ruling reads.";
  }
  if (citation.trim().length === 0) {
    return "Held: a ruling with no source is an opinion — cite where you read it (endpoints.ts:345).";
  }
  if (offersRule && draft.trim().length === 0) {
    return "Held: the general rule is empty. A rule with no words is not a rule.";
  }
  return null;
}

/**
 * The ruling's VALUE, resolved from the choice. Kept beside the hold because
 * the two are one decision read twice, and a second spelling of "which string
 * does `none` send" is how a nullable ruling turns into an empty one.
 */
export function rulingValue(
  choice: ValueChoice,
  valueA: string | null,
  valueB: string | null,
  typed: string,
): string | null {
  if (choice === "a") return valueA;
  if (choice === "b") return valueB;
  if (choice === "other") return typed.trim();
  return null;
}
