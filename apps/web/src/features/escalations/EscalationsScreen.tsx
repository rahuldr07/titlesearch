import { useState } from "react";
import { Empty, Segment, SegmentedControl } from "../../components/ui";
import { usePermissions, hasAction } from "../../app/session/permissions";
import { useSignedIn } from "../../app/session/signedIn";
import { QueryState } from "../../entities/state/QueryState";
import { useConfirmRule, useEscalations, useResolveEscalation, useRules } from "./useEscalations";
import { EscalationQueue } from "./EscalationQueue";
import { EscalationDetail } from "./EscalationDetail";
import { CandidateList } from "./CandidateList";
import { RuleCandidates } from "./RuleCandidates";

/**
 * SCREEN 10 — QC & ESCALATIONS, at `/escalations` (authz.ts:68, `senior`/`admin`).
 *
 * `reference-app.html` § `isEscalations`: a 320px column holding a segmented
 * pill over an 11px pane label, then the cards; the right pane scrolls alone
 * against an 840px measure, and the escalation's own title is the h1.
 * `INVARIANTS:39` is the sentence under the pane label — no category, no
 * priority, no assignee, because `Escalation` carries no such field.
 *
 * Design §Screens 10 gates the determination buttons as "disabled + belongs to
 * QC". `INVARIANTS:42-43` says the opposite twice, and `/api/me/permissions`
 * returns THIS ROLE'S projection with the others unrepresented
 * (handlers.ts:1398-1405): no grant, no determination card, and no read-only
 * banner in its place. Resolve held for want of a RULE is resource state, not
 * role, so that one stays disabled-with-reason.
 */
export function EscalationsScreen() {
  const escalations = useEscalations();
  const rules = useRules();
  const permissions = usePermissions(useSignedIn((s) => s.account !== null));
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"queries" | "candidates">("queries");

  const rows = escalations.data?.escalations ?? [];
  const book = rules.data?.rules ?? [];
  const current = rows.find((row) => row.id === selected) ?? rows[0] ?? null;

  const resolve = useResolveEscalation(current?.id ?? null);
  const confirm = useConfirmRule();

  const mayResolve = hasAction(permissions.data?.rules, "escalation.resolve");
  const mayConfirm = hasAction(permissions.data?.rules, "rule.confirm");
  const queries = view === "queries";

  return (
    <div
      data-testid="escalations-screen"
      className="tp-screen-enter flex h-full min-h-0 w-full overflow-hidden"
    >
      <div className="flex w-160 shrink-0 flex-col border-r border-line-strong bg-surface-panel">
        <div className="flex flex-col gap-6 border-b border-line-subtle p-8">
          <SegmentedControl
            label="Escalations views"
            selectedKeys={new Set([view])}
            onSelectionChange={(keys) => {
              setView([...keys][0] === "candidates" ? "candidates" : "queries");
            }}
          >
            <Segment id="queries">QC queries</Segment>
            <Segment id="candidates">Rule candidates</Segment>
          </SegmentedControl>

          <div className="flex flex-col gap-2">
            <span className="font-sans text-label leading-flat font-bold text-ink-muted">
              {queries ? "Active exception queue" : "Learned pattern review"}
            </span>
            {queries && (
              <p className="font-sans text-label leading-close text-ink-muted">
                no category, no priority, no assignee — just the rule
              </p>
            )}
          </div>
        </div>

        {/* Loading and failure are QueryState's: an empty queue and an
            unreachable one are different sentences, and the `loading` flag this
            replaced drew "Nothing escalated" over a failed read. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {queries ? (
            <QueryState query={escalations} of="the escalation queue">
              {(data) => (
                <EscalationQueue
                  escalations={data.escalations}
                  selectedId={current?.id ?? null}
                  onSelect={setSelected}
                />
              )}
            </QueryState>
          ) : (
            <QueryState query={rules} of="the rulebook">
              {(data) => (
                <CandidateList
                  candidates={data.rules.filter((rule) => rule.status === "pending")}
                />
              )}
            </QueryState>
          )}
        </div>
      </div>

      {/* A scrolling pane must be keyboard-reachable and named (WCAG 2.1.1). */}
      <div
        tabIndex={0}
        role="region"
        aria-label={queries ? "Escalation detail" : "Rule candidate review"}
        className="tp-state flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-surface-app"
      >
        <div className="w-full max-w-420 p-16">
          {queries ? (
            <QueryState query={escalations} of="the escalation queue">
              {() =>
                current === null ? (
                  <Empty
                    title="Nothing to inspect"
                    reason="Select a query from the sidebar to inspect it. The sidebar is empty, so no reviewer has raised one."
                  />
                ) : (
                  <EscalationDetail
                    escalation={current}
                    rules={book}
                    resolving={resolve.pending}
                    /* Rules 42/43: absent, not disabled. */
                    {...(mayResolve
                      ? { onResolve: (ruling, rule) => resolve.resolve({ ruling, rule }) }
                      : { onResolve: null })}
                  />
                )
              }
            </QueryState>
          ) : (
            <QueryState query={rules} of="the rulebook">
              {(data) => (
                <RuleCandidates
                  rules={data.rules}
                  canConfirm={mayConfirm}
                  confirming={confirm.pending}
                  refusal={confirm.refusal}
                  onConfirm={confirm.confirm}
                />
              )}
            </QueryState>
          )}
        </div>
      </div>
    </div>
  );
}
