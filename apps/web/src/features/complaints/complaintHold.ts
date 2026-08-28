/**
 * WHY AN ACT ON THIS SCREEN IS HELD, IN ONE SENTENCE PER CAUSE.
 *
 * Split out of the two cards for the reason `escalations/holdReason.ts` is:
 * this is the only part of them that is a RULE rather than a rendering, and the
 * rule is testable on its own.
 *
 * `null` means live. That inverted convention is `components/ui/disabled.ts`'s
 * — the kit has no boolean disabled prop, so a REASON is the disablement and
 * the absence of one is the only way to enable a control.
 *
 * ══ THESE ARE NOT THE SERVER'S REFUSALS, AND THEY DO NOT IMPERSONATE ONE ═══
 *
 * `INVARIANTS:14` — "the client never authors the refusal text" — governs what
 * comes BACK from a request. These sentences are why a request is not being
 * sent, which is a different thing and has to be said in the client because
 * only the client knows the form is half-filled. They are phrased as a HOLD
 * ("Held: …"), never as a verdict, so a reader can tell them apart from the
 * server's sentence in the toast. Every one of them is ALSO enforced at
 * handlers.ts (422 on the schema, 404 on an unknown rule) — the form states the
 * reason early; the server is the enforcement.
 */

export type RuleMode = "cite" | "draft";

/**
 * `§0.5 MANDATORY` as it applies to complaints. `endpoints.ts:548`: "the
 * complaint loop terminates in a rule (principle 3: escalations,
 * reconciliation, AND complaints all produce a rulebook entry) … REFUSED
 * without a rule, exactly like escalation resolution."
 *
 * A sentence per cause rather than one "complete the form": an ops lead who has
 * typed the fix and sees a dead button needs to be told the MISSING THING IS A
 * RULE. A generic prompt would leave the whole point of the loop unsaid.
 */
export function resolveHold(
  resolution: string,
  mode: RuleMode,
  ruleId: string | null,
  draft: string,
): string | null {
  if (resolution.trim().length === 0) {
    return "Held: a resolution needs the fix AND the rule it terminates in (endpoints.ts:548).";
  }
  if (mode === "cite" && ruleId === null) {
    return "Held: a fix alone does not close the loop — cite the rule it rests on.";
  }
  if (mode === "draft" && draft.trim().length === 0) {
    return "Held: the draft is empty. A rule with no words is not a rule.";
  }
  return null;
}

/**
 * Filing one. `CreateComplaintRequest` (endpoints.ts:509) types `order_id` and
 * `field_path` as bare `z.string()` with no `.min(1)`, so an empty pair would
 * be ACCEPTED on the wire and would file a complaint against nothing. Held here
 * rather than widened or worked around.
 *
 * CONTRACT GAP: `order_id` and `field_path` want `.min(1)` in
 * `packages/contract` — a defect record that names no order and no field is not
 * a defect record. Not fixed here; the contract is not this app's to edit.
 */
export function reportHold(orderId: string, fieldPath: string): string | null {
  if (orderId.trim().length === 0) {
    return "Held: a complaint is against a delivered order — name the order it shipped on.";
  }
  if (fieldPath.trim().length === 0) {
    return "Held: name the field the client says is wrong. A report with no field cannot be classified.";
  }
  return null;
}
