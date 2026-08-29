import type { Rule } from "@titlepipe/contract";
import { cx } from "../../components/ui";

/**
 * WHAT A RULE IS CURRENTLY DOING TO THE PIPELINE, STATED IN WORDS.
 *
 * `RulePill` is the reference — a code, dashed and struck when inert. This is
 * the other half of `INVARIANTS:38`, and the two are deliberately separate
 * objects: a pill appears in catalogs and inline in prose, where a full
 * sentence would be noise, while this appears at the MOMENT OF RECORD — the
 * instant a resolution is written and the reader has to know whether anything
 * changed.
 *
 * ══ WHY THIS SHOUTS, WHEN RULE 4 SAYS SENTENCE CASE ════════════════════════
 *
 * The wording and the capitals are QUOTED from the harvested invariant
 * (`e2e/invariants/escalations.spec.ts`), which pins
 * `/PENDING — CANNOT AFFECT THE PIPELINE UNTIL AN ENGINEER CONFIRMS/`. That
 * spec is a product requirement (CONTEXT §14), the migration rule forbids
 * weakening it, and softening the sentence to satisfy a typographic rule would
 * do exactly that. RECIPES rule 6 also permits a coloured capsule "at moments
 * of record", which is precisely what this is. Flagged rather than absorbed.
 *
 * ══ NOT A DERIVATION ═══════════════════════════════════════════════════════
 *
 * `status` is the server's own field (`entities.ts:153-162`). Nothing here
 * infers liveness from an origin, a confirmer, or from how the rule was
 * created. `INVARIANTS:4` — the server's returned state is what renders.
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
