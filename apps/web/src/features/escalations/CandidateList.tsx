import type { Rule } from "@titlepipe/contract";
import { Empty } from "../../components/ui";
import { RulePill } from "../../entities/rule/RulePill";

/**
 * The candidate cards print only what the server has: `Rule` carries no
 * observed value, citation, or time, so those lines are absent rather than
 * composed. The cards select nothing — there is no per-candidate route or
 * selection in this screen's contract.
 */
export function CandidateList({ candidates }: { readonly candidates: readonly Rule[] }) {
  if (candidates.length === 0) {
    return (
      <Empty
        title="No candidates"
        reason="A candidate appears here when a cluster is resolved with a drafted rule."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {candidates.map((rule) => (
        <div
          key={rule.id}
          data-candidate={rule.id}
          className="flex flex-col gap-3 rounded-lg border border-line-strong bg-surface-panel p-7"
        >
          {/* flex-wrap: a rule code broken across two lines cannot be matched
              to the rulebook. */}
          <RulePill code={rule.code} status={rule.status} className="flex-wrap" />
          <p className="font-sans text-meta leading-close font-semibold text-ink-primary">
            {rule.text}
          </p>
          {/* A null scope is a statement — the rule is unscoped — so it is
              said, not left blank. */}
          <p className="font-sans text-label leading-close font-medium text-ink-muted">
            Origin: {rule.origin} ·{" "}
            {rule.jurisdiction_scope ?? "every jurisdiction — unscoped"}
          </p>
        </div>
      ))}
    </div>
  );
}
