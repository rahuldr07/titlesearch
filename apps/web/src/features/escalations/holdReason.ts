/**
 * Why a resolution is held, one sentence per cause — the missing thing is a
 * rule, and a generic "complete the form" would leave that unsaid. `null`
 * means live: the kit has no boolean disabled prop, so a reason is the
 * disablement.
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
