import { useState } from "react";
import { Tab, TabList, TabPanel, Tabs } from "../../components/ui";
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
import { RuleCandidates } from "./RuleCandidates";

/**
 * SCREEN 10 — QC & ESCALATIONS, at `/escalations` (authz.ts:68, `senior`/`admin`).
 *
 * ══ A DESIGN/CONTRACT COLLISION, RESOLVED FOR THE CONTRACT ═════════════════
 *
 * Design §Screens 10: determination buttons are "role-gated (disabled +
 * 'belongs to QC — with R. Menon' for others)". Design rule 12 says the same:
 * "blocked actions render disabled with the rule, not hidden."
 *
 * `INVARIANTS:42-43` says the opposite, twice: "a role-locked affordance is
 * ABSENT, not disabled", "doors outside the role's world are ABSENT, not
 * dimmed." The contract enforces it structurally —
 * `GET /api/me/permissions` returns THIS ROLE'S PROJECTION with other worlds
 * unrepresented (handlers.ts:1398-1405), so the client is not withholding a
 * grant it can see; it never received one.
 *
 * THE CONTRACT WINS and the determination affordance is absent without
 * `escalation.resolve` (authz.ts:104). Recorded rather than reconciled: the
 * design and INVARIANTS genuinely disagree here and INVARIANTS is not edited to
 * make this file look consistent.
 *
 * Note the two rules are NOT in conflict everywhere. Rule 9/12's
 * disabled-with-reason still governs a control blocked by RESOURCE STATE — the
 * resolve button held for want of a rule is exactly that, and it is disabled
 * with its reason. The distinction: what you may never do is absent, what you
 * cannot do YET says why.
 */
export function EscalationsScreen() {
  const escalations = useEscalations();
  const rules = useRules();
  const permissions = usePermissions(useSignedIn((s) => s.account !== null));
  const [selected, setSelected] = useState<string | null>(null);

  const rows = escalations.data?.escalations ?? [];
  const current = rows.find((row) => row.id === selected) ?? rows[0] ?? null;

  const resolve = useResolveEscalation(current?.id ?? null);
  const confirm = useConfirmRule();

  const mayResolve = hasAction(permissions.data?.rules, "escalation.resolve");
  const mayConfirm = hasAction(permissions.data?.rules, "rule.confirm");

  return (
    <div data-testid="escalations-screen" className="flex h-full min-h-0 flex-col gap-12 overflow-y-auto p-14">
      <header className="flex flex-col gap-3">
        <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
          QC &amp; escalations
        </h1>
        {/*
         * `INVARIANTS:39`, an ORPHAN RULE — written down nowhere else in the
         * repository, so this sentence and its spec are the whole record of it.
         * There is no category control, no priority, no assignee on this screen
         * because `Escalation` has no such field and must not grow one.
         */}
        <p className="font-sans text-meta leading-body text-ink-secondary">
          no category, no priority, no assignee — just the rule
        </p>
      </header>

      <Tabs>
        <TabList label="Escalations views">
          <Tab id="queue">Queue</Tab>
          <Tab id="candidates">Rule candidates</Tab>
        </TabList>

        <TabPanel id="queue">
          <div className="grid grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-12">
            <EscalationQueue
              escalations={rows}
              loading={escalations.isPending}
              selectedId={current?.id ?? null}
              onSelect={setSelected}
            />
            {current !== null && (
              <EscalationDetail
                escalation={current}
                rules={rules.data?.rules ?? []}
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
            )}
          </div>
        </TabPanel>

        <TabPanel id="candidates">
          <RuleCandidates
            rules={rules.data?.rules ?? []}
            canConfirm={mayConfirm}
            confirming={confirm.isPending}
            onConfirm={(ruleId) => confirm.mutate(ruleId)}
          />
        </TabPanel>
      </Tabs>
    </div>
  );
}
