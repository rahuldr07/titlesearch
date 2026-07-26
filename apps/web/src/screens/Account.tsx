import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ack,
  AuditResponse,
  MePermissionsResponse,
  RulesResponse,
  canDo,
  type Rule,
} from "@titlepipe/contract";
import { api } from "../api";
import { MutationNote } from "../components/notice";
import { ScreenFrame, TopBar } from "../components/TopBar";
import { session, useSession, type Role } from "../session";

/**
 * Account layer (frontend-master-prompt §4.16) — last on purpose. Auth is
 * MOCKED locally (no Clerk wiring yet): Me carries the demo identity and a
 * role switch standing in for login. Rulebook is the heart: origin / status
 * / jurisdiction badges, PENDING visibly inert behind the engineer gate.
 * Audit is a read-only append-only view — there is no write affordance.
 *
 * CONTRACT GAPs (static panels until endpoints exist): My Org, People,
 * Retention, Billing.
 */

const TABS = ["Me", "Rulebook", "Audit", "Retention", "Billing"] as const;
type Tab = (typeof TABS)[number];

export function AccountScreen() {
  const [tab, setTab] = useState<Tab>("Rulebook");
  return (
    <ScreenFrame>
      <TopBar
        title="Account"
        links={[
          { label: "Readout", to: "/dashboard" },
          { label: "Blind fifty status", to: "/blind-status" },
          // the typist's door back to their seat — canAccess filtering hides
          // it from every role that doesn't hold /blind
          {
            label: "Blind capture",
            to: "/blind/$orderId",
            params: { orderId: "ord_demo_1" },
          },
        ]}
      >
        <div className="flex overflow-hidden rounded-sm border border-line-strong">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`cursor-pointer border-none px-3 py-[5px] font-sans text-[12px] font-semibold ${
                tab === t ? "bg-page-ref text-ink-on-action" : "bg-surface-panel text-ink-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </TopBar>
      <div className="flex-1 overflow-y-auto px-[22px] pt-[18px] pb-[60px]">
        <div className="mx-auto max-w-[900px]">
          {tab === "Me" && <MeTab />}
          {tab === "Rulebook" && <RulebookTab />}
          {tab === "Audit" && <AuditTab />}
          {tab === "Retention" && (
            <GapPanel
              title="Retention"
              body="Per-tenant retention windows + secure deletion (WISP). No endpoint in the contract yet — the policy lives server-side; this panel renders it when it ships."
            />
          )}
          {tab === "Billing" && (
            <GapPanel
              title="Billing"
              body="Per-engine cost ledger rollups land here (cost + latency are recorded per call already). No endpoint in the contract yet."
            />
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}

function GapPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-surface-panel px-6 py-6">
      <div className="text-[14px] font-semibold">{title}</div>
      <div className="mt-2 max-w-[560px] text-[12.5px] leading-[1.55] text-ink-secondary">
        {body}
      </div>
    </div>
  );
}

const ROLES: Role[] = ["reviewer", "senior", "ops", "engineer", "typist", "admin"];

function MeTab() {
  const [role, setRole] = useState<Role>(session.role);
  // Rules-as-data: the role's projection FETCHED from the server, not read
  // from the local table — the P1 wire shape, exercised now. The role in the
  // key re-fetches on switch (the header carries the new role at call time).
  const meQ = useQuery({
    queryKey: ["me", "permissions", role],
    queryFn: () => api(MePermissionsResponse, "/api/me/permissions"),
  });
  const doors = (meQ.data?.rules ?? []).filter((r) => r.path !== undefined);
  const actions = (meQ.data?.rules ?? []).filter((r) => r.path === undefined);
  return (
    <div className="rounded-md border border-line-strong bg-surface-panel px-6 py-5">
      <div className="text-[14px] font-semibold">{session.name}</div>
      <div className="mt-1 text-[12px] text-ink-secondary">
        auth is mocked locally — Clerk lands with the core-api. The role below
        stands in for login; roles are named by job.
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            data-testid={`role-${r}`}
            onClick={() => {
              session.role = r;
              setRole(r);
            }}
            className={`cursor-pointer rounded-sm border px-3 py-[5px] font-mono text-[12px] ${
              role === r
                ? "border-page-ref bg-page-ref-surface font-semibold text-page-ref"
                : "border-line-strong bg-surface-panel text-ink-secondary"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="mt-3 text-[11.5px] leading-[1.5] text-ink-secondary">
        Reviewers never see the dashboard, metrics, or anything
        throughput-adjacent; typists see only the capture screen. The real
        gate is server-side with Clerk claims — this switch exists so the
        gating renders honestly in dev.
      </div>
      <div className="mt-4 border-t border-line-subtle pt-4" data-testid="my-world">
        <div className="text-[11px] font-bold tracking-[.08em] text-ink-secondary">
          YOUR WORLD — AS THE SERVER SERVES IT
        </div>
        <div className="mt-1 max-w-[560px] text-[11.5px] leading-[1.5] text-ink-secondary">
          This list is GET /api/me/permissions rendered verbatim — the client
          re-derives nothing, and other roles' capabilities are not in the
          payload.
        </div>
        {meQ.isPending && (
          <p className="mt-2 text-[12px] text-ink-secondary">Fetching your world…</p>
        )}
        {meQ.error != null && (
          <p className="mt-2 text-[12px] text-state-halt">
            Permissions unavailable: {String(meQ.error)}
          </p>
        )}
        {meQ.data !== undefined && (
          <>
            <div className="mt-3 flex flex-wrap gap-[6px]">
              {doors.map((d) => (
                <span
                  key={d.action}
                  className="rounded-xs border border-line-strong bg-surface-raised px-2 py-[2px] font-mono text-[11px] text-ink-secondary"
                >
                  {d.path}
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-[6px]">
              {actions.map((a) => (
                <span
                  key={a.action}
                  className="rounded-xs border border-page-ref-border bg-page-ref-surface px-2 py-[2px] font-mono text-[11px] text-page-ref"
                >
                  {a.action}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const originBadge: Record<Rule["origin"], string> = {
  spec: "border-line-strong bg-track text-ink-secondary",
  escalation: "border-page-ref-border bg-page-ref-surface text-page-ref",
  reconciliation: "border-page-ref-border bg-page-ref-surface text-page-ref",
  complaint: "border-state-halt-border bg-state-halt-surface text-state-halt",
  senior: "border-state-settled-border bg-state-settled-surface text-state-settled",
};

function RulebookTab() {
  const queryClient = useQueryClient();
  const role = useSession((s) => s.role);
  const rulesQ = useQuery({
    queryKey: ["rules"],
    queryFn: () => api(RulesResponse, "/api/rules"),
  });
  const confirm = useMutation({
    mutationFn: (rule: Rule) =>
      api(Ack, `/api/rules/${rule.id}/confirm`, { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rules"] }),
    onError: () => void queryClient.invalidateQueries({ queryKey: ["rules"] }),
  });

  const rules = rulesQ.data?.rules ?? [];
  const pending = rules.filter((r) => r.status === "pending");

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-[14px]">
        <div className="text-[15px] font-bold">
          The rulebook — one book, versioned, origin-tagged
        </div>
        <div className="text-[12.5px] text-ink-secondary tabular-nums">
          {rules.filter((r) => r.status === "live").length} live ·{" "}
          <span className={pending.length > 0 ? "font-bold text-state-attend" : ""}>
            {pending.length} draft{pending.length === 1 ? "" : "s"} pending
          </span>
        </div>
        <div className="text-[11.5px] text-ink-secondary">
          four channels feed it — spec · escalation · reconciliation ·
          complaint — and nothing goes live without a named engineer
        </div>
      </div>
      {rulesQ.isPending && (
        <p className="mt-2 text-[13px] text-ink-secondary">Fetching the rulebook…</p>
      )}
      {rulesQ.error != null && (
        <p className="mt-2 text-[13px] text-state-halt">
          Rulebook unavailable: {String(rulesQ.error)}
        </p>
      )}
      {rules.map((r) => {
        const inert = r.status === "pending";
        return (
          <div
            key={r.id}
            data-testid={`rule-${r.code}`}
            className={`mt-[10px] rounded-md border px-4 py-3 ${
              inert
                ? "border-dashed border-line-dashed bg-surface-raised opacity-80"
                : "border-line-strong bg-surface-panel"
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-[10px]">
              <span className="font-mono text-[13px] font-bold">{r.code}</span>
              <span
                className={`rounded-xs border px-[6px] py-px text-[9.5px] font-bold tracking-[.05em] uppercase ${originBadge[r.origin]}`}
              >
                {r.origin}
              </span>
              {inert ? (
                <span className="rounded-xs border border-line-dashed bg-surface-raised px-[6px] py-px text-[9.5px] font-bold tracking-[.05em] text-ink-secondary">
                  PENDING — CANNOT AFFECT THE PIPELINE
                </span>
              ) : (
                <span className="rounded-xs border border-state-settled-border bg-state-settled-surface px-[6px] py-px text-[9.5px] font-bold tracking-[.05em] text-state-settled">
                  {r.status.toUpperCase()}
                </span>
              )}
              {r.jurisdiction_scope !== null && (
                <span className="rounded-xs border border-state-idle-border bg-state-idle-surface px-[6px] py-px text-[9.5px] font-bold tracking-[.05em] text-state-idle">
                  {r.jurisdiction_scope}
                </span>
              )}
              <span className="ml-auto text-[10.5px] text-ink-muted">
                v{r.version}
                {r.confirmed_by !== null && ` · confirmed by ${r.confirmed_by}`}
              </span>
            </div>
            <div
              className={`mt-[6px] text-[12.5px] leading-[1.5] ${
                inert ? "text-ink-secondary" : "text-ink-primary"
              }`}
            >
              {r.text}
            </div>
            {/* The confirm affordance exists only for holders of the
                engineer gate — everyone else sees the PENDING chip, not a
                dead button (authz table: rule.confirm). */}
            {inert && canDo(role, "rule.confirm") && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-testid={`confirm-${r.code}`}
                  onClick={() => confirm.mutate(r)}
                  disabled={confirm.isPending}
                  className="cursor-pointer rounded-sm border border-page-ref bg-page-ref px-[14px] py-[5px] font-sans text-[12px] font-semibold text-ink-on-action"
                >
                  Confirm — engineer gate
                </button>
                <span className="text-[11px] text-ink-secondary">
                  confirming regenerates prompts for every engine — no
                  per-engine surgery
                </span>
                {confirm.error != null &&
                  confirm.variables?.id === r.id && (
                    <MutationNote
                      testid="confirm-rule-note"
                      error={confirm.error}
                    />
                  )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function AuditTab() {
  const auditQ = useQuery({
    queryKey: ["audit"],
    queryFn: () => api(AuditResponse, "/api/audit"),
  });
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-[14px]">
        <div className="text-[15px] font-bold">Audit — append-only</div>
        <div className="text-[11.5px] text-ink-secondary">
          read-only by construction: there is no write affordance on this
          screen and no write endpoint in the contract
        </div>
      </div>
      {auditQ.isPending && (
        <p className="mt-2 text-[13px] text-ink-secondary">Fetching the log…</p>
      )}
      {auditQ.error != null && (
        <p className="mt-2 text-[13px] text-state-halt">
          Audit unavailable: {String(auditQ.error)}
        </p>
      )}
      <div className="mt-3 overflow-hidden rounded-md border border-line-strong bg-surface-panel">
        {(auditQ.data?.entries ?? []).map((e) => (
          <div
            key={e.id}
            className="grid grid-cols-[150px_130px_1fr] items-baseline gap-3 border-b border-line-subtle px-4 py-2"
          >
            <span className="font-mono text-[11.5px] text-ink-secondary">
              {new Intl.DateTimeFormat("en-US", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(new Date(e.at))}
            </span>
            <span className="text-[12px] font-semibold">{e.actor_id}</span>
            <span className="font-mono text-[12px] text-ink-secondary">
              {e.action} · {e.entity}/{e.entity_id}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
