import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ack,
  EscalationsResponse,
  ResolveEscalationRequest,
  RulesResponse,
  type Escalation,
  type Rule,
} from "@titlepipe/contract";
import { api } from "../api";
import { MutationNote } from "../components/notice";
import { ScreenFrame, TopBar } from "../components/TopBar";

/**
 * Escalation Inbox (frontend-master-prompt §4.4), to the Escalation
 * Inbox.dc.html pixel spec: a rules backlog, clustered by field path — every
 * item is a reviewer saying "I don't know the rule."
 *
 * The §0.5 refusal is structural here: RESOLUTION IS REFUSED WITHOUT A RULE.
 * Cite an existing rule or draft a new one — a draft lands PENDING (visibly
 * inert; an engineer must confirm it before it can affect the pipeline).
 * The submit button stays disabled until ResolveEscalationRequest itself
 * parses — the contract schema is the gate, not hand-rolled validation.
 *
 * Not ported from the .dc.html (no contract data — see CONTRACT GAP notes):
 * escalations-per-100-orders metric + sparklines, per-case asker/timestamps,
 * per-case source-page evidence and same-search context tables, right/wrong
 * per-case verdicts.
 */
export function EscalationInboxScreen() {
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);

  const escalationsQ = useQuery({
    queryKey: ["escalations"],
    queryFn: () => api(EscalationsResponse, "/api/escalations"),
  });
  const rulesQ = useQuery({
    queryKey: ["rules"],
    queryFn: () => api(RulesResponse, "/api/rules"),
  });

  const clusters = useMemo(() => {
    const byPath = new Map<string, Escalation[]>();
    for (const e of escalationsQ.data?.escalations ?? []) {
      const list = byPath.get(e.field_path_cluster) ?? [];
      list.push(e);
      byPath.set(e.field_path_cluster, list);
    }
    return [...byPath.entries()].map(([path, items]) => ({
      path,
      items,
      open: items.filter((e) => e.resolution === null),
    }));
  }, [escalationsQ.data]);

  const openClusters = clusters
    .filter((c) => c.open.length > 0)
    .sort((a, b) => b.open.length - a.open.length);
  const resolvedClusters = clusters.filter((c) => c.open.length === 0);
  const current =
    clusters.find((c) => c.path === selectedCluster) ??
    openClusters[0] ??
    clusters[0] ??
    null;
  const rules = rulesQ.data?.rules ?? [];

  return (
    <ScreenFrame>
      <TopBar
        title="Escalation inbox"
        links={[
          { label: "Review queue", to: "/queue" },
          { label: "Readout", to: "/dashboard" },
        ]}
      >
        <div className="text-[12px] text-ink-dim">
          a rules backlog — every item is a reviewer saying “I don't know the
          rule”
        </div>
      </TopBar>
      <div className="flex min-h-0 flex-1">
        <div className="w-[380px] flex-none overflow-y-auto border-r border-line-strong bg-surface px-[14px] pt-4 pb-10">
          <div className="px-1 pb-[10px] text-[10.5px] font-bold tracking-[.1em] text-label">
            OPEN — GROUPED BY WHAT'S CONFUSING PEOPLE, NOT BY TIME
          </div>
          {escalationsQ.isPending && (
            <p className="px-1 text-[12px] text-ink-dim">Fetching the inbox…</p>
          )}
          {escalationsQ.error != null && (
            <p className="px-1 text-[12px] text-act">
              Inbox unavailable: {String(escalationsQ.error)}
            </p>
          )}
          {rulesQ.error != null && (
            <p className="px-1 text-[12px] text-act">
              Rulebook unavailable: {String(rulesQ.error)}
            </p>
          )}
          {openClusters.map((c) => (
            <ClusterCard
              key={c.path}
              path={c.path}
              items={c.items}
              rules={rules}
              selected={current?.path === c.path}
              onSelect={() => setSelectedCluster(c.path)}
            />
          ))}
          {openClusters.length === 0 && (
            <div className="px-1 text-[12px] text-ink-dim">
              Nothing open. The same question is never asked twice.
            </div>
          )}
          <div className="mt-2 border-t border-line-light px-1 pt-4 pb-[10px] text-[10.5px] font-bold tracking-[.1em] text-label">
            RESOLVED — RULES WRITTEN
          </div>
          {resolvedClusters.map((c) => (
            <ClusterCard
              key={c.path}
              path={c.path}
              items={c.items}
              rules={rules}
              selected={current?.path === c.path}
              onSelect={() => setSelectedCluster(c.path)}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto px-[26px] pt-5 pb-[60px]">
          {current && (
            <ClusterDetail
              cluster={current}
              rules={rules}
              onResolved={() => setSelectedCluster(current.path)}
            />
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}

function ruleOf(items: Escalation[], rules: Rule[]): Rule | null {
  const withRule = items.find((e) => e.rule_id !== null);
  if (!withRule) return null;
  return rules.find((r) => r.id === withRule.rule_id) ?? null;
}

/** Rule status chip — PENDING renders visibly inert, never like a live rule. */
function RuleStatusChip({ rule }: { rule: Rule }) {
  if (rule.status === "pending") {
    return (
      <span className="rounded-chip border border-dash bg-surface-dim px-[6px] py-px text-[10px] font-bold tracking-[.05em] text-ink-dim">
        PENDING — CANNOT AFFECT THE PIPELINE UNTIL AN ENGINEER CONFIRMS
      </span>
    );
  }
  return (
    <span className="rounded-chip border border-ok-border bg-ok-bg px-[6px] py-px text-[10px] font-bold tracking-[.05em] text-ok">
      {rule.status === "live" ? `LIVE IN PIPELINE — ${rule.code}` : rule.code}
    </span>
  );
}

function ClusterCard({
  path,
  items,
  rules,
  selected,
  onSelect,
}: {
  path: string;
  items: Escalation[];
  rules: Rule[];
  selected: boolean;
  onSelect: () => void;
}) {
  const open = items.filter((e) => e.resolution === null);
  const orders = new Set(items.flatMap((e) => e.order_ids)).size;
  const resolved = open.length === 0;
  const rule = ruleOf(items, rules);
  return (
    <div
      onClick={onSelect}
      data-testid={`cluster-${path}`}
      className={`mb-2 cursor-pointer rounded-[5px] border px-[14px] py-3 ${
        selected
          ? "border-action shadow-[inset_0_0_0_1px_var(--color-action)]"
          : "border-line-mid"
      } ${resolved ? "bg-surface-dim" : "bg-card"}`}
    >
      <div className="font-mono text-[13px] font-semibold leading-[1.35]">
        {path}
      </div>
      <div className="mt-1 text-[11.5px] text-ink-secondary tabular-nums">
        {items.length} escalation{items.length === 1 ? "" : "s"} · {orders}{" "}
        order{orders === 1 ? "" : "s"}
        {resolved ? " · cleared" : ` · ${open.length} open`}
      </div>
      {resolved && rule && (
        <div className="mt-[7px] flex flex-wrap items-center gap-2">
          <RuleStatusChip rule={rule} />
        </div>
      )}
    </div>
  );
}

function ClusterDetail({
  cluster,
  rules,
  onResolved,
}: {
  cluster: { path: string; items: Escalation[]; open: Escalation[] };
  rules: Rule[];
  onResolved: () => void;
}) {
  const resolved = cluster.open.length === 0;
  const rule = ruleOf(cluster.items, rules);
  const first = cluster.items.find((e) => e.resolution !== null);
  return (
    <div className="max-w-[880px]">
      <div className="flex flex-wrap items-baseline justify-between gap-[14px]">
        <div className="font-mono text-[18px] font-bold tracking-[-.01em]">
          {cluster.path}
        </div>
      </div>
      <div className="mt-[5px] text-[13px] text-ink-secondary tabular-nums">
        {cluster.items.length} escalation
        {cluster.items.length === 1 ? "" : "s"} ·{" "}
        {new Set(cluster.items.flatMap((e) => e.order_ids)).size} orders
      </div>

      {!resolved && (
        <ResolveCard cluster={cluster} rules={rules} onResolved={onResolved} />
      )}

      {resolved && first && (
        <div className="mt-4 rounded-card border border-ok-border bg-ok-bg px-[18px] py-4">
          <div className="text-[13px] font-bold text-ok">
            ✓ Rule written — cluster cleared.
          </div>
          <div className="mt-2 text-[16px] leading-[1.5] text-ink italic">
            “{first.resolution}”
          </div>
          <div className="mt-[10px] flex flex-wrap items-center gap-[10px]">
            {rule && <RuleStatusChip rule={rule} />}
            <span className="text-[12px] text-ink-secondary">
              resolved by {first.resolved_by}
            </span>
          </div>
        </div>
      )}

      <div className="mt-[22px] mb-[10px] text-[11px] font-bold tracking-[.08em] text-label">
        THE EVIDENCE — EVERY QUESTION, VERBATIM.
      </div>
      {cluster.items.map((e) => (
        <div
          key={e.id}
          className="mb-[7px] rounded-[5px] border border-line-mid bg-card px-[14px] py-[11px]"
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[13.5px] font-medium leading-[1.4]">
              “{e.question}”
            </div>
            {e.resolution !== null && (
              <span className="flex-none text-[10.5px] font-semibold text-ok">
                ✓ resolved
              </span>
            )}
          </div>
          {/* Context-carrying navigation: arrive at the exact field in its
              exact order — you already know which field (the cluster). */}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11.5px]">
            {e.order_ids.map((oid) => (
              <Link
                key={oid}
                to="/orders/$orderId/review"
                params={{ orderId: oid }}
                search={{ field: cluster.path }}
                data-testid={`open-field-${oid}`}
                className="text-action no-underline hover:underline"
              >
                {oid} → field
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResolveCard({
  cluster,
  rules,
  onResolved,
}: {
  cluster: { path: string; open: Escalation[] };
  rules: Rule[];
  onResolved: () => void;
}) {
  const queryClient = useQueryClient();
  const [ruling, setRuling] = useState("");
  const [mode, setMode] = useState<"cite" | "draft">("cite");
  const [citedRuleId, setCitedRuleId] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftScope, setDraftScope] = useState("");

  /** The request the schema must admit — the contract is the refusal gate. */
  const candidate = {
    ruling: ruling.trim(),
    rule:
      mode === "cite"
        ? { rule_id: citedRuleId }
        : {
            draft: {
              text: draftText.trim(),
              jurisdiction_scope: draftScope.trim() === "" ? null : draftScope.trim(),
            },
          },
  };
  const valid =
    ResolveEscalationRequest.safeParse(candidate).success &&
    (mode !== "cite" || citedRuleId !== "");

  const resolve = useMutation({
    mutationFn: async () => {
      // The ruling + rule clear the CLUSTER: the same resolution posts to
      // every open escalation in it (the per-order answer is incidental).
      for (const e of cluster.open) {
        await api(Ack, `/api/escalations/${e.id}/resolve`, {
          method: "POST",
          body: JSON.stringify(candidate),
        });
      }
    },
    onSuccess: () => {
      onResolved();
      void queryClient.invalidateQueries({ queryKey: ["escalations"] });
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    // The per-escalation loop can half-succeed — the refetch shows what
    // actually cleared; the note says why the rest didn't.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["escalations"] });
      void queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });

  const citable = rules.filter((r) => r.status === "live");

  return (
    <div className="mt-4 rounded-card border border-line-strong bg-card px-[18px] py-4 shadow-card">
      <div className="mb-2 text-[11px] font-bold tracking-[.08em] text-action">
        THE RULING — ONE SENTENCE, YOUR WORDS. THE RULE IT CITES IS WHAT THE
        SCREEN IS FOR; THE PER-ORDER ANSWER IS INCIDENTAL.
      </div>
      <textarea
        data-testid="ruling-input"
        value={ruling}
        onChange={(e) => setRuling(e.target.value)}
        placeholder="e.g. “A hit is ours when name + county match and it was filed during our grantor's ownership; dismissed cases stay off.”"
        className="min-h-[64px] w-full resize-y rounded-[5px] border-[1.5px] border-dash bg-input px-[14px] py-3 font-sans text-[15.5px] leading-[1.5] text-ink"
      />
      <div className="mt-3 text-[11px] font-bold tracking-[.08em] text-label">
        THE RULE — REQUIRED. A RULING WITHOUT A RULE IS REFUSED.
      </div>
      <div className="mt-2 flex gap-4 text-[12.5px]">
        <label className="flex cursor-pointer items-center gap-[6px]">
          <input
            type="radio"
            checked={mode === "cite"}
            onChange={() => setMode("cite")}
          />
          cite an existing rule
        </label>
        <label className="flex cursor-pointer items-center gap-[6px]">
          <input
            type="radio"
            data-testid="mode-draft"
            checked={mode === "draft"}
            onChange={() => setMode("draft")}
          />
          draft a new one — lands PENDING
        </label>
      </div>
      {mode === "cite" && (
        <select
          data-testid="cite-select"
          value={citedRuleId}
          onChange={(e) => setCitedRuleId(e.target.value)}
          className="mt-2 w-full max-w-[560px] rounded-btn border border-line-strong bg-input px-2 py-[6px] font-sans text-[12.5px]"
        >
          <option value="">— pick the rule this ruling applies —</option>
          {citable.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} — {r.text.slice(0, 90)}
            </option>
          ))}
        </select>
      )}
      {mode === "draft" && (
        <div className="mt-2 flex max-w-[560px] flex-col gap-2">
          <textarea
            data-testid="draft-input"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="the general rule, one sentence — it lands PENDING and cannot affect the pipeline until an engineer confirms it"
            className="min-h-[48px] w-full resize-y rounded-btn border border-dash bg-input px-[10px] py-2 font-sans text-[13px]"
          />
          <input
            value={draftScope}
            onChange={(e) => setDraftScope(e.target.value)}
            placeholder="jurisdiction scope — optional, e.g. GA"
            className="w-[240px] rounded-btn border border-line-strong bg-input px-[10px] py-[5px] font-mono text-[12px]"
          />
        </div>
      )}
      <div className="mt-[10px] flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          data-testid="resolve-btn"
          disabled={!valid || resolve.isPending}
          onClick={() => resolve.mutate()}
          className={`rounded-btn px-[18px] py-2 font-sans text-[13px] font-semibold ${
            valid
              ? "cursor-pointer border border-action bg-action text-ink-invert"
              : "cursor-not-allowed border-[1.5px] border-dashed border-dash bg-track text-ink-dim"
          }`}
        >
          {valid
            ? `Resolve — clears ${cluster.open.length} escalation${cluster.open.length === 1 ? "" : "s"}`
            : "Resolve — held, needs a ruling and a rule"}
        </button>
        <div className="text-[11.5px] text-ink-dim">
          no category, no priority, no assignee — just the rule
        </div>
      </div>
      {resolve.error != null && (
        <MutationNote testid="resolve-note" error={resolve.error} />
      )}
    </div>
  );
}
