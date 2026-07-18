import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ack,
  AuditResponse,
  RulesResponse,
  type Rule,
} from "@titlepipe/contract";
import { api } from "../api";
import { ScreenFrame, TopBar } from "../components/TopBar";
import { session, type Role } from "../session";

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
        ]}
      >
        <div className="flex overflow-hidden rounded-btn border border-line-strong">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`cursor-pointer border-none px-3 py-[5px] font-sans text-[12px] font-semibold ${
                tab === t ? "bg-action text-ink-invert" : "bg-card text-ink-secondary"
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
    <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-6">
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
  return (
    <div className="rounded-card border border-line-strong bg-card px-6 py-5">
      <div className="text-[14px] font-semibold">{session.name}</div>
      <div className="mt-1 text-[12px] text-ink-dim">
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
            className={`cursor-pointer rounded-btn border px-3 py-[5px] font-mono text-[12px] ${
              role === r
                ? "border-action bg-sel-bg font-semibold text-action"
                : "border-line-strong bg-card text-ink-secondary"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="mt-3 text-[11.5px] leading-[1.5] text-ink-dim">
        Reviewers never see the dashboard, metrics, or anything
        throughput-adjacent; typists see only the capture screen. The real
        gate is server-side with Clerk claims — this switch exists so the
        gating renders honestly in dev.
      </div>
    </div>
  );
}

const originBadge: Record<Rule["origin"], string> = {
  spec: "border-line bg-track text-ink-secondary",
  escalation: "border-action-border bg-action-bg text-action",
  reconciliation: "border-action-border bg-action-bg text-action",
  complaint: "border-act-border bg-act-bg text-act",
  senior: "border-ok-border bg-ok-bg text-ok",
};

function RulebookTab() {
  const queryClient = useQueryClient();
  const rulesQ = useQuery({
    queryKey: ["rules"],
    queryFn: () => api(RulesResponse, "/api/rules"),
  });
  const confirm = useMutation({
    mutationFn: (rule: Rule) =>
      api(Ack, `/api/rules/${rule.id}/confirm`, { method: "POST" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["rules"] }),
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
          <span className={pending.length > 0 ? "font-bold text-attend" : ""}>
            {pending.length} drafts pending
          </span>
        </div>
        <div className="text-[11.5px] text-ink-dim">
          four channels feed it — spec · escalation · reconciliation ·
          complaint — and nothing goes live without a named engineer
        </div>
      </div>
      {rules.map((r) => {
        const inert = r.status === "pending";
        return (
          <div
            key={r.id}
            data-testid={`rule-${r.code}`}
            className={`mt-[10px] rounded-card border px-4 py-3 ${
              inert
                ? "border-dashed border-dash bg-surface-dim opacity-80"
                : "border-line-mid bg-card"
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-[10px]">
              <span className="font-mono text-[13px] font-bold">{r.code}</span>
              <span
                className={`rounded-chip border px-[6px] py-px text-[9.5px] font-bold tracking-[.05em] uppercase ${originBadge[r.origin]}`}
              >
                {r.origin}
              </span>
              {inert ? (
                <span className="rounded-chip border border-dash bg-surface-dim px-[6px] py-px text-[9.5px] font-bold tracking-[.05em] text-ink-dim">
                  PENDING — CANNOT AFFECT THE PIPELINE
                </span>
              ) : (
                <span className="rounded-chip border border-ok-border bg-ok-bg px-[6px] py-px text-[9.5px] font-bold tracking-[.05em] text-ok">
                  {r.status.toUpperCase()}
                </span>
              )}
              {r.jurisdiction_scope !== null && (
                <span className="rounded-chip border border-neutral-border bg-neutral-bg px-[6px] py-px text-[9.5px] font-bold tracking-[.05em] text-neutral">
                  {r.jurisdiction_scope}
                </span>
              )}
              <span className="ml-auto text-[10.5px] text-ink-faint">
                v{r.version}
                {r.confirmed_by !== null && ` · confirmed by ${r.confirmed_by}`}
              </span>
            </div>
            <div
              className={`mt-[6px] text-[12.5px] leading-[1.5] ${
                inert ? "text-ink-dim" : "text-ink-body"
              }`}
            >
              {r.text}
            </div>
            {inert && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  data-testid={`confirm-${r.code}`}
                  onClick={() => confirm.mutate(r)}
                  disabled={confirm.isPending}
                  className="cursor-pointer rounded-btn border border-action bg-action px-[14px] py-[5px] font-sans text-[12px] font-semibold text-ink-invert"
                >
                  Confirm — engineer gate
                </button>
                <span className="text-[11px] text-ink-dim">
                  confirming regenerates prompts for every engine — no
                  per-engine surgery
                </span>
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
        <div className="text-[11.5px] text-ink-dim">
          read-only by construction: there is no write affordance on this
          screen and no write endpoint in the contract
        </div>
      </div>
      <div className="mt-3 overflow-hidden rounded-card border border-line-mid bg-card">
        {(auditQ.data?.entries ?? []).map((e) => (
          <div
            key={e.id}
            className="grid grid-cols-[150px_130px_1fr] items-baseline gap-3 border-b border-hairline px-4 py-2"
          >
            <span className="font-mono text-[11.5px] text-ink-dim">
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
