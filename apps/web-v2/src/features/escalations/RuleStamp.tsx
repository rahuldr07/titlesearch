import type { Rule } from "@titlepipe/contract";
import { Chip } from "../../shared/ui/Chip";

/**
 * A RESOLVED CLUSTER SHOWS WHAT ITS RULE CAN ACTUALLY DO, read off the rule's
 * own status rather than off the fact that someone clicked resolve.
 *
 * A PENDING RULE RENDERS VISIBLY INERT (`escalations.spec` #3), in full words
 * and not as a tasteful grey. A draft that looks live is worse than no rule:
 * the reviewer stops escalating, and nothing downstream has changed.
 */
export function RuleStamp({ rule }: { rule: Rule | undefined }) {
  if (rule === undefined) {
    return (
      <Chip tone="neutral" size="sm" bordered>
        RULE NOT FOUND
      </Chip>
    );
  }
  if (rule.status === "pending") {
    return (
      <Chip tone="attend" size="sm" bordered>
        {rule.code} — PENDING — CANNOT AFFECT THE PIPELINE UNTIL AN ENGINEER
        CONFIRMS
      </Chip>
    );
  }
  if (rule.status === "retired") {
    return (
      <Chip tone="neutral" size="sm" bordered>
        {rule.code} — RETIRED
      </Chip>
    );
  }
  return (
    <Chip tone="settled" size="sm" bordered>
      LIVE IN PIPELINE — {rule.code}
    </Chip>
  );
}
