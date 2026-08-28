import { useState } from "react";
import { Segment, SegmentedControl } from "../../components/ui";
import { usePermissions, hasAction } from "../../app/session/permissions";
import { useSignedIn } from "../../app/session/signedIn";
import { notify } from "../../shared/notify";
import {
  useConfirmRule,
  useEscalations,
  useResolveEscalation,
  useRules,
} from "./useEscalations";
import { EscalationQueue } from "./EscalationQueue";
import { EscalationDetail } from "./EscalationDetail";
import { CandidateList } from "./CandidateList";
import { RuleCandidates } from "./RuleCandidates";

/**
 * SCREEN 10 — QC & ESCALATIONS, at `/escalations` (authz.ts:68, `senior`/`admin`).
 *
 * ══ THE SHELL IS THE PROTOTYPE'S, MEASURED ═════════════════════════════════
 *
 * `reference-app.html` § `isEscalations`: a 320px white column against the app
 * canvas, holding a segmented pill (16px pad, 12px below it) over an 11px pane
 * label; then the cards. The right pane scrolls on its own, 32px of padding
 * against an 840px measure. There is NO screen h1 and no screen subhead — the
 * escalation's own title is the h1, so the old header block is gone. The views
 * are a SEGMENTED CONTROL, not `Tabs`, because that is the pill drawn. The
 * counts are the lengths actually held; the prototype's "(3)"/"(1)" are fixture.
 *
 * `INVARIANTS:39`, an ORPHAN RULE — written down nowhere else in the
 * repository, so the sentence under the pane label is the whole record of it.
 * It moved out of the deleted screen header and into the inbox column, which is
 * the thing it is about: there is no category control, no priority, no assignee
 * on this screen because `Escalation` has no such field and must not grow one.
 *
 * ══ A DESIGN/CONTRACT COLLISION, RESOLVED FOR THE CONTRACT ═════════════════
 *
 * Design §Screens 10 gates the determination buttons as "disabled + 'belongs to
 * QC'". `INVARIANTS:42-43` says the opposite, twice: a role-locked affordance
 * is ABSENT, not disabled — and the contract enforces it, since
 * `GET /api/me/permissions` returns THIS ROLE'S PROJECTION with other worlds
 * unrepresented (handlers.ts:1398-1405). THE CONTRACT WINS: no
 * `escalation.resolve`, no determination card. Rule 9/12's
 * disabled-with-reason still governs a control blocked by RESOURCE STATE — the
 * resolve button held for want of a rule is exactly that.
 */
export function EscalationsScreen() {
  const escalations = useEscalations();
  const rules = useRules();
  const permissions = usePermissions(useSignedIn((s) => s.account !== null));
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"queries" | "candidates">("queries");

  const rows = escalations.data?.escalations ?? [];
  const book = rules.data?.rules ?? [];
  const candidates = book.filter((rule) => rule.status === "pending");
  const current = rows.find((row) => row.id === selected) ?? rows[0] ?? null;

  const resolve = useResolveEscalation(current?.id ?? null);
  const confirm = useConfirmRule();

  const mayResolve = hasAction(permissions.data?.rules, "escalation.resolve");
  const mayConfirm = hasAction(permissions.data?.rules, "rule.confirm");

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
              {view === "queries" ? "Active exception queue" : "Learned pattern review"}
            </span>
            {view === "queries" && (
              <p className="font-sans text-label leading-close text-ink-muted">
                no category, no priority, no assignee — just the rule
              </p>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {view === "queries" ? (
            <EscalationQueue
              escalations={rows}
              loading={escalations.isPending}
              selectedId={current?.id ?? null}
              onSelect={setSelected}
            />
          ) : (
            <CandidateList candidates={candidates} loading={rules.isPending} />
          )}
        </div>
      </div>

      {/* A scrolling pane must be keyboard-reachable and named (WCAG 2.1.1). */}
      <div
        tabIndex={0}
        role="region"
        aria-label={view === "queries" ? "Escalation detail" : "Rule candidate review"}
        className="tp-state flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-surface-app"
      >
        <div className="w-full max-w-420 p-16">
          {view === "queries" ? (
            current !== null && (
              <EscalationDetail
                escalation={current}
                rules={book}
                resolving={resolve.isPending}
                /* Rules 42/43: absent, not disabled. A senior holds the grant;
                   anybody else gets a detail pane with no determination on it. */
                {...(mayResolve
                  ? {
                      onResolve: (ruling, rule) =>
                        resolve.mutate({ ruling, rule }, {
                          onSuccess: () => notify.success("✓ Rule written — cluster cleared."),
                        }),
                    }
                  : { onResolve: null })}
              />
            )
          ) : (
            <RuleCandidates
              rules={book}
              canConfirm={mayConfirm}
              confirming={confirm.pending}
              refusal={confirm.refusal}
              onConfirm={confirm.confirm}
            />
          )}
        </div>
      </div>
    </div>
  );
}
