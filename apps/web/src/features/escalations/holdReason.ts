/**
 * WHY A RESOLUTION IS HELD, IN ONE SENTENCE PER CAUSE.
 *
 * Split out of `ResolveCard` because it is the only part of that screen that is
 * a RULE rather than a rendering, and because the rule is testable on its own:
 * `§0.5 MANDATORY` (`INVARIANTS:36`, endpoints.ts:233-236) says a resolution is
 * refused without a rule, and this function is that sentence in code.
 *
 * A sentence per cause rather than one "complete the form": a senior who has
 * typed a ruling and sees a dead button needs to be told the MISSING THING IS A
 * RULE, which is precisely the requirement the design omits. A generic prompt
 * would leave the whole point of the screen unsaid.
 *
 * `null` means live. That inverted convention is `disabled.ts`'s: the kit has
 * no boolean disabled prop, so a reason IS the disablement, and the absence of
 * a reason is the only way to enable a control.
 */
export type ResolutionMode = "cite" | "draft";

export function holdReason(
  ruling: string,
  mode: ResolutionMode,
  ruleId: string | null,
  draft: string,
): string | null {
  if (ruling.trim().length === 0) {
    return "Held: a resolution needs a ruling AND a rule (§0.5 MANDATORY).";
  }
  if (mode === "cite" && ruleId === null) {
    return "Held: a ruling alone is not a resolution — cite the rule it rests on.";
  }
  if (mode === "draft" && draft.trim().length === 0) {
    return "Held: the draft is empty. A rule with no words is not a rule.";
  }
  return null;
}
