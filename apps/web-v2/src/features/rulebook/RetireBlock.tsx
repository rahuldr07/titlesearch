import { useState } from "react";
import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { RetireConfirm } from "./RetireConfirm";
import { USED_BY, USED_BY_CAPTION } from "./designFixture";

/**
 * RETIREMENT — the only way a live rule stops applying. Nothing is deleted.
 *
 * WHAT USED THIS RULE IS SHOWN BEFORE THE RETIRE CONTROL IS ARMED. A live rule
 * is not an abstraction: it is the explanation printed into some number of
 * delivered reports, and the person retiring it should see that before they act
 * rather than discover it in a complaint. Every listed order says "v1 unchanged
 * by retirement" for the same reason — retirement is forward-only, and a
 * reviewer who thinks it rewrites history will retire a rule to fix a report.
 *
 * ARMING IS A SEPARATE STEP FROM CONFIRMING. "Retire…" reveals the impact
 * preview; the preview is what you confirm against. Collapsing the two into one
 * button would make retiring a live rule a single click, which is the same
 * weight as a filter change.
 *
 * CONTRACT GAP: the contract has no `rule.retire` action in the authz table and
 * no retire endpoint — `POST /api/rules/{id}/confirm` is the only rule mutation
 * that exists. `Rule` also carries no usage count. The order list below is the
 * design's sample and says so; the confirm control is inert.
 */
export function RetireBlock({ mayRetire }: { mayRetire: boolean }) {
  const [showUsedBy, setShowUsedBy] = useState(false);
  const [armed, setArmed] = useState(false);

  return (
    <section data-testid="rule-retire" className="border-t border-line-subtle pt-7">
      <div className="mb-5 flex flex-wrap items-center gap-6">
        <p className="flex-1 text-sm text-ink-secondary">
          Used by delivered reports.{" "}
          <button
            type="button"
            data-testid="used-by-toggle"
            onClick={() => setShowUsedBy(!showUsedBy)}
            className="font-semibold text-action underline"
          >
            {showUsedBy ? "hide" : "see which"}
          </button>
        </p>

        {mayRetire && !armed ? (
          <Button
            size="md"
            fill="outlined"
            tone="halt"
            data-testid="arm-retire"
            onClick={() => setArmed(true)}
          >
            Retire…
          </Button>
        ) : null}
      </div>

      {showUsedBy ? (
        <div className="mb-5 rounded-7 border border-line-strong bg-surface-app px-6 py-5">
          <Eyebrow variant="field" as="h3">
            Delivered reports that used this rule
          </Eyebrow>
          <p className="mt-3 rounded-5 border border-state-attend-border border-dashed bg-state-attend-surface px-5 py-3 text-xs leading-body text-state-attend-ink">
            {USED_BY_CAPTION}
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {USED_BY.map((order) => (
              <li key={order} className="flex flex-wrap items-baseline gap-5 text-xs">
                <span className="font-mono font-semibold text-ink-primary">{order}</span>
                <span className="text-ink-muted">delivered · v1 unchanged by retirement</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mayRetire ? null : (
        <p className="rounded-7 border border-state-halt-border bg-state-halt-surface px-6 py-5 text-sm leading-body text-state-halt-ink">
          Retiring is restricted to engineer and admin — it changes extraction as
          much as confirming does.
        </p>
      )}

      {armed ? <RetireConfirm onCancel={() => setArmed(false)} /> : null}
    </section>
  );
}
