import type { Rule } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * What a rule is currently doing to the pipeline, stated in words at the
 * moment of record; RulePill is the inline reference form. The capitals are
 * deliberate despite the sentence-case rule: the wording is pinned verbatim
 * by e2e/invariants/escalations.spec.ts
 * (/PENDING — CANNOT AFFECT THE PIPELINE UNTIL AN ENGINEER CONFIRMS/), and
 * softening it would weaken a product-requirement spec. `status` is the
 * server's own field — nothing here infers liveness from anything else.
 */
const EFFECT = {
  live: {
    chrome: "border-state-settled-border bg-state-settled-surface text-state-settled",
    say: (code: string) => `LIVE IN PIPELINE — ${code}`,
  },
  pending: {
    chrome: "border-state-attend-border bg-state-attend-surface text-state-attend",
    say: () => "PENDING — CANNOT AFFECT THE PIPELINE UNTIL AN ENGINEER CONFIRMS",
  },
  retired: {
    chrome: "border-control-border bg-surface-sunken text-ink-muted",
    say: (code: string) => `RETIRED — NO LONGER BINDING — ${code}`,
  },
} as const;

export function RuleEffect({
  code,
  status,
  className,
}: {
  readonly code: Rule["code"];
  readonly status: Rule["status"];
  readonly className?: string | undefined;
}) {
  const effect = EFFECT[status];
  return (
    <p
      data-rule-effect={status}
      data-rule-code={code}
      className={cx(
        "rounded-sm border px-6 py-4 font-sans text-label leading-close font-bold",
        effect.chrome,
        className,
      )}
    >
      {effect.say(code)}
    </p>
  );
}
