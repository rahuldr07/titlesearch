import { useState } from "react";
import { useRead } from "../../app/useRead";
import { usePermissions, hasAction } from "../../app/session/permissions";
import { useSignedIn } from "../../app/session/signedIn";
import { complaints } from "../../shared/complaintsQueries";
import { rules as rulebook } from "../../shared/accountQueries";
import { notify } from "../../shared/notify";
import { Empty } from "../../components/ui";
import { QueryState } from "../../entities/state/QueryState";
import { ComplaintList } from "./ComplaintList";
import { ComplaintDetail } from "./ComplaintDetail";
import { ReportComplaintCard } from "./ReportComplaintCard";
import { useRecordComplaint, useResolveComplaint } from "./useComplaints";

/**
 * THE POST-DELIVERY DEFECT LOOP, at `/complaints` (`authz.ts:71`,
 * `ops`/`admin`).
 *
 * A client reports a defect on a report that already shipped; it is classified
 * by HOW IT GOT THROUGH (`enums.ts:96-98`); and it TERMINATES IN A RULEBOOK
 * ENTRY (`endpoints.ts:548`, principle 3 — escalations, reconciliation and
 * complaints all produce one). A resolution without a rule is refused.
 *
 * ══ THIS SCREEN IS IN NO DESIGN ════════════════════════════════════════════
 *
 * It is absent from the 2026-08 prototype entirely, so there is no drawing to
 * measure and nothing here is transcribed. It is built to the SYSTEM — RECIPES,
 * the 14 rules, and the shape `features/escalations` already established for a
 * refusal-bearing mutation screen, which this is the second instance of.
 *
 * ══ THE RULEBOOK READ IS THE ACCOUNT SCREEN'S DESCRIPTOR ═══════════════════
 *
 * `accountQueries.rules`, key `["rules"]`, and deliberately not a second
 * spelling in `complaintsQueries.ts`. Rule 11 for cache keys: two caches of the
 * rulebook fail silently, as a rule that is `pending` in one pane and `live` in
 * another — the exact distinction `INVARIANTS:38` turns on.
 *
 * ══ WHAT IS NOT ON THIS SCREEN ═════════════════════════════════════════════
 *
 * No count of complaints, no rate, no age, no time-to-close, and no "N open"
 * headline. `INVARIANTS:23` and `26`: no pace indicators, no throughput
 * language, no timers, no estimates — and a defect loop is exactly where a
 * closure rate would grow. The two groups print their rows; nothing counts them.
 *
 * ══ `hasAction` DOES NOT EVALUATE THE GRANT'S CONDITION ════════════════════
 *
 * `complaint.resolve` is granted `when: { resolution: [null] }` (`authz.ts:117`)
 * — the grant narrows to STILL-OPEN complaints. `hasAction` is a string lookup
 * and evaluates no condition, by design (`permissions.ts:44-50`: "a string
 * comparison, not a policy evaluation"). The condition is honoured structurally
 * instead: `ComplaintDetail` renders the resolve card only while `rule_id` is
 * null, and the server refuses a replay with a 409 (handlers.ts:1061), which is
 * an ANSWER and surfaces verbatim (`INVARIANTS:16`, `19`).
 */
export function ComplaintsScreen() {
  const list = useRead(complaints);
  const rules = useRead(rulebook);
  const permissions = usePermissions(useSignedIn((s) => s.account !== null));
  const [selected, setSelected] = useState<string | null>(null);
  /** Bumped on a filed complaint; remounts the form, which is how it clears. */
  const [filed, setFiled] = useState(0);

  const record = useRecordComplaint();
  const resolve = useResolveComplaint();

  const mayRecord = hasAction(permissions.data?.rules, "complaint.record");
  const mayResolve = hasAction(permissions.data?.rules, "complaint.resolve");

  const rows = list.data?.complaints ?? [];
  const current = rows.find((row) => row.id === selected) ?? rows[0] ?? null;

  return (
    <div
      data-testid="complaints-screen"
      className="tp-screen-enter flex h-full min-h-0 flex-col gap-12 overflow-y-auto p-14"
    >
      <header className="flex flex-col gap-3">
        <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
          Complaints
        </h1>
        <p className="font-sans text-meta leading-body text-ink-secondary">
          A defect a client found in a delivered report, grouped by how it got
          through, and closed only on a rulebook entry.
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-12">
        <div className="flex flex-col gap-10">
          <QueryState query={list} of="the complaints">
            {(data) => (
              <ComplaintList
                complaints={data.complaints}
                selectedId={current?.id ?? null}
                onSelect={setSelected}
              />
            )}
          </QueryState>

          {/* Rules 42/43: absent, not disabled. Without the grant there is no
              filing control at all — nothing to dim, nothing withheld. */}
          {mayRecord && (
            <ReportComplaintCard
              key={filed}
              pending={record.pending}
              onReport={(order, path, clientValue) =>
                record.submit(
                  { order_id: order, field_path: path, client_value: clientValue },
                  () => {
                    setFiled((n) => n + 1);
                    notify.success("Complaint recorded.");
                  },
                )
              }
            />
          )}
        </div>

        <QueryState query={rules} of="the rulebook">
          {(book) =>
            current === null ? (
              <Empty
                title="No complaint selected"
                reason="Nothing has been reported against a delivered report, so there is nothing to close."
              />
            ) : (
              <ComplaintDetail
                complaint={current}
                rules={book.rules}
                resolving={resolve.pending}
                {...(mayResolve
                  ? {
                      onResolve: (resolution, rule, goldenOffer) =>
                        resolve.submit(
                          current.id,
                          { resolution, rule, golden_offer_accepted: goldenOffer },
                          () => notify.success("Rule written — the loop is closed."),
                        ),
                    }
                  : { onResolve: null })}
              />
            )
          }
        </QueryState>
      </div>
    </div>
  );
}
