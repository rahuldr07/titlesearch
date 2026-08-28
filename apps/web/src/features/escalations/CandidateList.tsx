import type { Rule } from "@titlepipe/contract";
import { Empty } from "../../components/ui";
import { RulePill } from "../../entities/rule/RulePill";

/**
 * THE LEFT COLUMN UNDER "LEARNED PATTERN REVIEW".
 *
 * `reference-app.html` § `isEscalations`, `escCandidates`: the same 14px card
 * as a queue row, but the top line is a scope capsule and a quiet timestamp,
 * and the body names the field and cites where the pattern was seen.
 *
 * WHAT IS PRINTED HERE IS WHAT THE SERVER HAS. `Rule` carries a code, a status,
 * an origin and a `jurisdiction_scope`; it carries no observed value, no
 * citation and no time, so the prototype's "Saw: …", "p14 l22 · Warranty Deed"
 * and "today 10:14 AM" are absent rather than composed. The capsule holds the
 * status, which is the one thing about a candidate that matters
 * (`INVARIANTS:38`) — and the pane beside it says what that status DOES.
 *
 * These cards do not select anything: there is no per-candidate route or
 * selection in this screen's contract, and adding one would be a new
 * affordance rather than the drawing.
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
          {/* `flex-wrap`: in a 320px column the pill's note would otherwise
              squeeze the code, and a rule CODE broken across two lines is a
              code the reader cannot match to the rulebook (rule 3). */}
          <RulePill code={rule.code} status={rule.status} className="flex-wrap" />
          <p className="font-sans text-meta leading-close font-semibold text-ink-primary">
            {rule.text}
          </p>
          {/* `jurisdiction_scope: null` is a STATEMENT — the rule is not scoped
              — so it is said, not left blank (rule 14, applied to a scope). */}
          <p className="font-sans text-label leading-close font-medium text-ink-muted">
            Origin: {rule.origin} ·{" "}
            {rule.jurisdiction_scope ?? "every jurisdiction — unscoped"}
          </p>
        </div>
      ))}
    </div>
  );
}
