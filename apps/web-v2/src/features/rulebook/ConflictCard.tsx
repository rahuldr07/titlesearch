import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { CONFLICT_COUNTERPART, CONFLICT_NOTE } from "./designFixture";

/**
 * CONFLICT — NEITHER WINS SILENTLY.
 *
 * Two rules whose outcomes contradict each other are drawn side by side, at
 * equal weight, with no default. That symmetry is the point: a system that
 * quietly picks the newer rule, or the narrower one, produces a report nobody
 * can explain afterwards — and "why did it exclude that deed" is a question
 * with a client on the other end of it.
 *
 * THE THREE WAYS OUT ARE ALL SOMEBODY'S SIGNATURE. Retire one, narrow a scope,
 * or rule on it. There is deliberately no fourth option that resolves the
 * collision without a person, and no "dismiss" — a conflict that can be
 * dismissed is a conflict that comes back on the next order.
 *
 * The rule in conflict CANNOT GO LIVE while this card is on screen. That is
 * enforced by `ConfirmBlock`'s reason, not by disabling anything here, because
 * the resolution paths must stay reachable exactly when confirmation is not.
 *
 * CONTRACT GAP: `Rule` carries no counterpart id — nothing on the wire says
 * these two rules collide — and there is no endpoint behind retire, narrow or
 * rule-on-it. The counterpart shown is the design's, and the three controls are
 * inert and say so rather than pretending to act.
 */
export function ConflictCard({ code, outcome }: { code: string; outcome: string }) {
  return (
    <Card tone="halt" data-testid="rule-conflict" className="p-7">
      <Eyebrow variant="caption" tone="halt" as="h3">
        Conflict — neither wins silently
      </Eyebrow>

      <div className="mt-5 flex flex-wrap items-center gap-5">
        <Side code={code} outcome={outcome} />
        <span className="font-mono text-xs font-bold text-state-halt-ink">vs</span>
        <Side code={CONFLICT_COUNTERPART.id} outcome={CONFLICT_COUNTERPART.outcome} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button size="sm" fill="outlined" tone="neutral" disabled>
          Retire one
        </Button>
        <Button size="sm" fill="outlined" tone="neutral" disabled>
          Narrow a scope
        </Button>
        <Button size="sm" fill="outlined" tone="neutral" disabled>
          Rule on it
        </Button>
      </div>

      <p className="mt-5 rounded-6 border border-line-strong bg-surface-panel px-5 py-4 text-xs leading-body text-ink-secondary">
        {CONFLICT_NOTE}
      </p>
    </Card>
  );
}

/**
 * One side of the collision. Both sides use the same component, on purpose.
 *
 * NEUTRAL GROUND INSIDE A HALT ONE, and `tone="none"` is what fixes that as a
 * pair: the two rules are not themselves alarming, the collision between them
 * is. A side drawn in halt would say each rule is a problem, which is the
 * default this card refuses to pick.
 */
function Side({ code, outcome }: { code: string; outcome: string }) {
  return (
    <Card size="nested" className="min-w-75 flex-1 p-5">
      <p className="font-mono text-xs font-semibold text-ink-primary">{code}</p>
      <p className="mt-2 text-xs leading-close text-ink-secondary">{outcome}</p>
    </Card>
  );
}
