import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MetricsResponse } from "@titlepipe/contract";
import { api } from "../api";
import { ScreenFrame, TopBar } from "../components/TopBar";

/**
 * Blind Fifty Status (frontend-master-prompt §4.14), to the Blind Fifty
 * Status.dc.html pixel spec: read-only funnel — you see the state, you act
 * elsewhere. Coverage progress including the judgment-field count vs the
 * ≥40 gate (the only remaining gate to judgment automation). NO typist
 * speed or pace data exists here or anywhere: submitted-counts are
 * order-level only, and the divergence gap prompt is "ask why in person".
 */
export function BlindStatusScreen() {
  const metricsQ = useQuery({
    queryKey: ["metrics"],
    queryFn: () => api(MetricsResponse, "/api/metrics"),
  });
  const bf = metricsQ.data?.blind_fifty;

  const statusInk = (s: "submitted" | "in_progress" | "not_started") =>
    s === "submitted"
      ? "font-semibold text-ok"
      : s === "in_progress"
        ? "text-action"
        : "text-line-strong";
  const statusText = (s: "submitted" | "in_progress" | "not_started") =>
    s === "submitted" ? "✓ submitted" : s === "in_progress" ? "in progress" : "·";

  return (
    <ScreenFrame>
      <TopBar
        title="Blind fifty — status"
        // CONTRACT GAP: rows here should deep-link to /reconciliation/{order}
        // ("in progress — 5 of 9 ruled" is an invitation to act), but the
        // funnel shape carries order_ref only, no order id. The old
        // "Reconciliation queue" link pointed at THIS screen — a lie; gone.
        links={[{ label: "Rulebook", to: "/account" }]}
      >
        <div className="text-[12.5px] text-ink-secondary">
          read-only — you see the state, you act elsewhere
        </div>
      </TopBar>
      {bf && (
        <>
          <div className="flex flex-none flex-wrap gap-3 bg-bg px-[18px] py-3">
            <div className="min-w-[280px] rounded-card border-[1.5px] border-attend-border bg-attend-bg px-[18px] py-3">
              <div className="text-[10.5px] font-bold tracking-[.08em] text-attend">
                READY FOR RECONCILIATION
              </div>
              <div className="mt-[2px] flex items-baseline gap-[10px]">
                <span
                  data-testid="ready-count"
                  className="font-mono text-[30px] font-semibold text-attend-strong"
                >
                  {bf.ready_for_reconciliation}
                </span>
                <span className="text-[12px] leading-[1.4] text-attend-strong">
                  both typists done, senior hasn't started —
                  {bf.oldest_waiting_days != null && (
                    <>
                      <br />
                      oldest has waited <b>{bf.oldest_waiting_days} days</b>.
                      If this grows, the senior is the bottleneck.
                    </>
                  )}
                </span>
              </div>
            </div>
            <div className="min-w-[250px] rounded-card border border-line-mid bg-card px-[18px] py-3">
              <div className="text-[10.5px] font-bold tracking-[.08em] text-label">
                TYPIST DIVERGENCE — ORDER LEVEL ONLY
              </div>
              <div className="mt-[2px] flex items-baseline gap-[10px]">
                <span className="font-mono text-[20px] font-semibold">
                  A {bf.submitted_a} · B {bf.submitted_b}
                </span>
                <span className="text-[12px] text-ink-secondary">
                  submitted · gap {Math.abs(bf.submitted_a - bf.submitted_b)}{" "}
                  — a gap above 10 means someone has stalled; ask why in person
                </span>
              </div>
            </div>
            <div className="rounded-card border border-line-mid bg-card px-[18px] py-3">
              <div className="text-[10.5px] font-bold tracking-[.08em] text-label">
                RECONCILED
              </div>
              <div className="mt-[2px] font-mono text-[20px] font-semibold">
                {bf.reconciled}{" "}
                <span className="font-sans text-[12px] font-normal text-ink-dim">
                  of {bf.orders_total} — the count, not a percentage
                </span>
              </div>
            </div>
            <div className="rounded-card border border-line-mid bg-card px-[18px] py-3">
              <div className="text-[10.5px] font-bold tracking-[.08em] text-label">
                RULEBOOK DRAFTS PENDING
              </div>
              <div className="mt-[2px] font-mono text-[20px] font-semibold">
                {bf.drafts_pending}{" "}
                <Link
                  to="/account"
                  className="font-sans text-[12px] font-semibold no-underline"
                >
                  → rulebook
                </Link>
              </div>
              <div className="mt-[2px] text-[10.5px] text-ink-dim">
                amber above 5 · above 10 needs an engineer before the fifty
                closes
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-[18px] pt-1 pb-[50px]">
            <div className="max-w-[1120px]">
              <div className="grid grid-cols-[110px_120px_130px_130px_170px_minmax(120px,1fr)_90px] gap-[10px] px-3 py-[6px] text-[10px] font-bold tracking-[.08em] text-ink-faint">
                <span>ORDER</span>
                <span>JURISDICTION</span>
                <span>TYPIST A</span>
                <span>TYPIST B</span>
                <span>RECONCILIATION</span>
                <span>→ GOLDEN SET</span>
                <span>DRAFTS</span>
              </div>
              {bf.orders.map((o) => {
                const waiting = o.reconciliation?.startsWith("waiting") === true;
                return (
                  <div
                    key={o.order_ref}
                    className={`grid grid-cols-[110px_120px_130px_130px_170px_minmax(120px,1fr)_90px] items-baseline gap-[10px] rounded-[3px] border-b px-3 py-[5px] ${
                      waiting
                        ? "border-attend-bg bg-attend-bg"
                        : "border-surface-dim bg-card"
                    }`}
                  >
                    <span className="font-mono text-[12px] font-semibold">
                      {o.order_ref}
                    </span>
                    <span className="text-[11.5px] text-ink-secondary">
                      {o.jurisdiction}
                    </span>
                    <span className={`text-[11.5px] ${statusInk(o.a_submitted)}`}>
                      {statusText(o.a_submitted)}
                    </span>
                    <span className={`text-[11.5px] ${statusInk(o.b_submitted)}`}>
                      {statusText(o.b_submitted)}
                    </span>
                    <span
                      className={`text-[11.5px] ${
                        waiting
                          ? "font-bold text-attend"
                          : o.reconciliation === "complete"
                            ? "text-ok"
                            : o.reconciliation !== null
                              ? "font-semibold text-action"
                              : "text-line-strong"
                      }`}
                    >
                      {o.reconciliation ?? "—"}
                    </span>
                    <span className="font-mono text-[11.5px] text-ink-secondary">
                      {o.golden_line ?? ""}
                    </span>
                    <span className="text-[11.5px] text-ink-dim">
                      {o.drafts ?? ""}
                    </span>
                  </div>
                );
              })}
              <div className="px-3 py-2 text-[11px] text-ink-faint">
                sorted by reconciliation readiness, not order id — the
                actionable rows are already at the top. Field-level
                disagreements stay blind until reconciliation; the model
                appears nowhere.
              </div>
              <div className="mt-[14px] max-w-[640px] rounded-card border border-line-mid bg-card px-[18px] py-[14px]">
                <div className="mb-2 text-[11px] font-bold tracking-[.08em] text-label">
                  GOLDEN SET COVERAGE BY SECTION — WHAT THE BENCH WILL BE ABLE
                  TO SEE
                </div>
                {bf.section_coverage.map((c) => (
                  <div
                    key={c.section}
                    data-testid={`coverage-${c.section}`}
                    className="grid grid-cols-[150px_90px_1fr] items-baseline gap-3 border-b border-hairline py-[5px]"
                  >
                    <span
                      className={`font-mono text-[12px] ${
                        c.warn ? "font-bold text-attend" : "text-ink-secondary"
                      }`}
                    >
                      {c.section}
                    </span>
                    <span className="text-right font-mono text-[12.5px]">
                      {c.fields}
                      {c.warn &&
                        ` of ≥${bf.judgment_fields_target}`}
                    </span>
                    <span
                      className={`text-[11px] leading-[1.45] ${
                        c.warn ? "text-attend" : "text-ink-faint"
                      }`}
                    >
                      {c.note ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {metricsQ.isPending && (
        <p className="px-[18px] py-4 text-[13px] text-ink-dim">
          Reading the funnel…
        </p>
      )}
      {metricsQ.error != null && (
        <p className="px-[18px] py-4 text-[13px] text-act">
          Funnel unavailable: {String(metricsQ.error)}
        </p>
      )}
    </ScreenFrame>
  );
}
