import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DerivedSignalResponse,
  MetricsResponse,
} from "@titlepipe/contract";
import { api } from "../api";
import { fieldLabel } from "../components/field";
import { ScreenFrame, TopBar } from "../components/TopBar";
import { canAccess } from "../nav";
import { useSession } from "../session";

/**
 * Ops Dashboard — "Readout" (frontend-master-prompt §4.5) + derived
 * drill-down (§4.6), to the Ops Dashboard.dc.html pixel spec. catch_rate is
 * the headline; signals read in PAIRS; the field backlog is the engineering
 * queue, generated free. Every number opens its server-authored drill-down.
 *
 * Deliberate omissions vs the .dc.html (laws + contract):
 * - No probe drill-down: probes surface as aggregate counts ONLY — probe
 *   details never exist in any client shape (CONTEXT §14).
 * - No per-reviewer section: no per-reviewer shape exists in the contract,
 *   and anything person-ranked is designed out (§0.4).
 * - No aggregate accuracy number anywhere.
 * - The expectation line on the catch chart draws only when the SERVER sends
 *   `catch_rate_floor` — the UI owns no thresholds.
 */
export function OpsDashboardScreen() {
  const [drillSignal, setDrillSignal] = useState<string | null>(null);
  const sessionRole = useSession((s) => s.role);
  // §0.7 from the authz table, not a hand-rolled role branch: whoever lacks
  // the /dashboard door (reviewer, typist — and senior/engineer, whose
  // worlds also exclude it) gets the gate, and the metrics query never runs.
  const gated = !canAccess(sessionRole, "/dashboard");
  const metricsQ = useQuery({
    queryKey: ["metrics"],
    queryFn: () => api(MetricsResponse, "/api/metrics"),
    enabled: !gated,
  });
  if (gated) {
    return (
      <ScreenFrame>
        <TopBar title="Review system — readout" />
        <div className="mx-auto max-w-[520px] px-[22px] pt-[60px]">
          <div
            data-testid="role-gate"
            className="rounded-md border border-line-strong bg-surface-panel px-7 py-6"
          >
            <div className="text-[14px] font-semibold">Not your screen.</div>
            <div className="mt-2 text-[12.5px] leading-[1.55] text-ink-secondary">
              The readout is for ops. Nothing on it would help you review an
              order — and some of it would hurt. Your queue is the whole job.
            </div>
          </div>
        </div>
      </ScreenFrame>
    );
  }

  const m = metricsQ.data;
  const pct = (v: number | null | undefined, digits = 0) =>
    v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits)}%`;
  const falling =
    m?.catch_rate != null &&
    m.catch_rate_floor != null &&
    m.catch_rate < m.catch_rate_floor;

  return (
    <ScreenFrame>
      <TopBar
        title="Review system — readout"
        links={[
          { label: "Review queue", to: "/queue" },
          { label: "Escalation inbox", to: "/escalations" },
        ]}
      >
        <div className="text-[12.5px] text-ink-secondary">
          computed nightly · not real-time
        </div>
        <div className="text-[11.5px] text-ink-secondary">
          every number opens its underlying fields — a number you cannot
          interrogate is a number you will rationalise
        </div>
      </TopBar>
      <div className="flex-1 overflow-y-auto px-[22px] pt-[18px] pb-[60px]">
        {m && (
          <div className="mx-auto grid max-w-[1520px] grid-cols-[1.55fr_1fr] gap-[14px]">
            {/* catch rate — the headline */}
            <div
              className={`rounded-md bg-surface-panel px-[18px] py-4 ${
                falling ? "border-2 border-state-halt" : "border border-line-strong"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="text-[11px] font-bold tracking-[.1em] text-ink-secondary">
                  CATCH RATE — PLANTED DEFECTS CAUGHT · THE ONLY NUMBER HERE
                  THAT CANNOT BE GAMED
                </div>
                {falling && (
                  <span className="rounded-xs bg-state-halt px-2 py-[2px] text-[10.5px] font-bold tracking-[.06em] text-ink-on-action">
                    FALLING — ACT THIS WEEK
                  </span>
                )}
              </div>
              <div className="mt-[10px] flex flex-wrap items-end gap-[22px]">
                <div>
                  <div className="flex items-baseline gap-[10px]">
                    <span
                      data-testid="catch-rate"
                      className={`font-mono text-[52px] leading-none font-semibold ${
                        falling ? "text-state-halt" : "text-ink-primary"
                      }`}
                    >
                      {pct(m.catch_rate)}
                    </span>
                  </div>
                  <div className="mt-[6px] text-[12px] text-ink-secondary tabular-nums">
                    n = {m.probes_planted ?? "—"} probes this week ·{" "}
                    {m.probes_caught ?? "—"} caught
                  </div>
                  <div className="mt-2 max-w-[420px] text-[12.5px] leading-[1.5] text-ink-primary">
                    Rubber-stamping is automation bias, not a character flaw —
                    and this number is the only place it will ever show up.
                  </div>
                  <div className="mt-[6px] text-[11px] text-ink-secondary">
                    a perfect catch rate on tiny n is noise — the denominator
                    is always shown · probe details never render, only the
                    count
                  </div>
                </div>
                {m.catch_rate_history && m.catch_rate_history.length > 0 && (
                  <div className="min-w-[320px] flex-1">
                    <div className="relative flex h-[132px] items-end gap-1 border-b border-line-strong">
                      {m.catch_rate_history.map((v, i) => (
                        <div
                          key={i}
                          title={pct(v)}
                          className={`flex-1 rounded-t-[2px] ${
                            m.catch_rate_floor != null && v < m.catch_rate_floor
                              ? "bg-state-halt"
                              : "bg-line-dashed"
                          }`}
                          style={{
                            height: `${Math.round((v * 100 - 50) * 2.6)}px`,
                          }}
                        />
                      ))}
                      {m.catch_rate_floor != null && (
                        <>
                          <div
                            className="absolute right-0 left-0 border-t-[1.5px] border-dashed border-ink-secondary"
                            style={{
                              bottom: `${Math.round((m.catch_rate_floor * 100 - 50) * 2.6)}px`,
                            }}
                          />
                          <div
                            className="absolute right-0 text-[9.5px] tracking-[.05em] text-ink-secondary"
                            style={{
                              bottom: `${Math.round((m.catch_rate_floor * 100 - 50) * 2.6) + 3}px`,
                            }}
                          >
                            EXPECTED ≥ {Math.round(m.catch_rate_floor * 100)}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex justify-between text-[9.5px] text-ink-muted">
                      <span>{m.catch_rate_history.length} wks ago</span>
                      <span>this week</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* escalations per 100 */}
            <div className="rounded-md border border-line-strong bg-surface-panel px-[18px] py-4">
              <div className="text-[11px] font-bold tracking-[.1em] text-ink-secondary">
                ESCALATIONS PER 100 ORDERS — READ THE PLATEAU, NOT THE SLOPE
              </div>
              {m.escalations_per_100_history &&
                m.escalations_per_100_history.length > 0 && (
                  <>
                    <div className="relative mt-[14px] flex h-[150px] items-end gap-1 border-b border-line-strong">
                      {m.escalations_per_100_history.map((v, i) => (
                        <div
                          key={i}
                          title={v.toFixed(1)}
                          className={`flex-1 cursor-pointer rounded-t-[2px] ${
                            i >=
                            (m.escalations_per_100_history?.length ?? 0) - 5
                              ? "bg-page-ref"
                              : "bg-line-strong"
                          }`}
                          style={{ height: `${Math.round((v / 13) * 150)}px` }}
                          onClick={() => setDrillSignal("escalations")}
                        />
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[9.5px] text-ink-muted">
                      <span>
                        {m.escalations_per_100_history.length} wks ago
                      </span>
                      <span>this week</span>
                    </div>
                  </>
                )}
              <div className="mt-[10px] text-[12.5px] leading-[1.5] text-ink-primary">
                The early fall was inevitable — years of unwritten rules being
                written down. The plateau is the finding:{" "}
                <b>
                  ≈{m.escalations_per_100?.toFixed(1) ?? "—"} per 100 orders is
                  irreducible judgment
                </b>
                , and it sizes the permanent senior-reviewer headcount.
              </div>
              <div className="mt-[10px] flex items-baseline justify-between border-t border-line-subtle pt-2">
                <span className="text-[11.5px] text-ink-secondary">
                  volume this week:{" "}
                  <b className="text-ink-secondary">
                    {m.escalations_this_week ?? "—"}
                  </b>{" "}
                  — the rate above is the signal
                </span>
                <button
                  type="button"
                  onClick={() => setDrillSignal("escalations")}
                  className="cursor-pointer border-none bg-transparent p-0 text-[11px] font-semibold text-page-ref underline"
                >
                  open clusters →
                </button>
              </div>
            </div>

            {/* paired signals */}
            <div className="col-span-full grid grid-cols-3 gap-[14px]">
              <PairCard
                title="CORRECTIONS ÷ CATCHING — ONE UNIT, TWO READINGS"
                aLabel="correction rate"
                aVal={pct(m.correction_rate, 1)}
                aSub={`n = ${m.fields_reviewed ?? "—"} reviewed · ${m.corrected ?? "—"} corrected`}
                bLabel="catch rate, same weeks"
                bVal={pct(m.catch_rate)}
                bAct={falling}
                bSub={`n = ${m.probes_planted ?? "—"} probes`}
                footnote="Rising corrections can be good — it may mean reviewers are catching more."
                onDrill={() => setDrillSignal("corrections")}
              />
              <PairCard
                title="SPEED ÷ CATCHING — ONE UNIT, TWO READINGS"
                aLabel="time per order (median)"
                aVal={
                  m.median_minutes_per_order != null
                    ? `${m.median_minutes_per_order.toFixed(1)} min`
                    : "—"
                }
                aSub="hand-typing was 40–60 min"
                bLabel="catch rate, same weeks"
                bVal={pct(m.catch_rate)}
                bAct={falling}
                bSub="speed is only good if catching holds"
                footnote="The point was never speed; speed is what got this business here."
                onDrill={() => setDrillSignal("speed")}
              />
              <PairCard
                title="AUTO-CONFIRMED ÷ THEIR CORRECTION RATE — ONE UNIT"
                aLabel="fields auto-confirmed"
                aVal={pct(m.auto_confirm_rate)}
                aSub="of the fields on an order"
                bLabel="corrections in 5% sample"
                bVal={pct(m.auto_sample_correction_rate, 1)}
                bAct={false}
                bSub={`n = ${m.auto_sample_n ?? "—"} sampled`}
                footnote="High auto + high correction together would mean the threshold is set wrong."
                onDrill={() => setDrillSignal("auto")}
              />
            </div>

            {/* correction by source */}
            <div className="rounded-md border border-line-strong bg-surface-panel px-[18px] py-4">
              <div className="text-[11px] font-bold tracking-[.1em] text-ink-secondary">
                CORRECTION RATE BY SOURCE — WHERE THE EXTRACTION IS ACTUALLY
                FAILING
              </div>
              {(m.correction_by_source ?? []).map((s) => (
                <div
                  key={s.source}
                  onClick={() => setDrillSignal(`source:${s.source}`)}
                  className="grid cursor-pointer grid-cols-[100px_1fr_74px] items-center gap-3 border-b border-line-subtle py-[9px]"
                >
                  <span className="font-mono text-[12px] font-semibold">
                    {s.source}
                  </span>
                  <div>
                    <div className="h-[9px] overflow-hidden rounded-[2px] bg-track">
                      <div
                        className={`h-full ${s.alarm ? "bg-state-halt" : "bg-state-idle"}`}
                        style={{
                          width: `${Math.min(100, Math.round(s.correction_rate * 600))}%`,
                        }}
                      />
                    </div>
                    {s.note !== null && (
                      <div
                        className={`mt-[3px] text-[10.5px] ${
                          s.alarm
                            ? "font-semibold text-state-halt"
                            : "text-ink-muted"
                        }`}
                      >
                        {s.note}
                      </div>
                    )}
                  </div>
                  <span className="text-right font-mono text-[13px]">
                    {pct(s.correction_rate, 1)}
                  </span>
                </div>
              ))}
              <div className="mt-2 text-[10.5px] text-ink-secondary">
                n = corrected ÷ reviewed, per source · click a row for the
                fields behind it
              </div>
            </div>

            {/* field backlog */}
            <div className="rounded-md border border-line-strong bg-surface-panel px-[18px] py-4">
              <div className="text-[11px] font-bold tracking-[.1em] text-ink-secondary">
                FIELD-LEVEL BACKLOG — ORDERED BY CORRECTION RATE. THIS IS THE
                ENGINEERING QUEUE, GENERATED FREE.
              </div>
              {(m.field_backlog ?? []).map((f, i) => (
                <div
                  key={f.path}
                  data-testid={`backlog-${f.path}`}
                  onClick={() => setDrillSignal(`field:${f.path}`)}
                  className="grid cursor-pointer grid-cols-[1fr_120px_60px_60px] items-baseline gap-[10px] border-b border-line-subtle py-2"
                >
                  {/* the human name leads; the raw path stays for grep/telemetry talk */}
                  <span className="text-[12px]">
                    <b>{fieldLabel(f.path)}</b>{" "}
                    <span className="font-mono text-[10.5px] text-ink-secondary">
                      {f.path}
                    </span>
                  </span>
                  <div className="h-2 self-center overflow-hidden rounded-[2px] bg-track">
                    <div
                      className={`h-full ${i === 0 ? "bg-state-halt" : "bg-state-idle"}`}
                      style={{
                        width: `${Math.round(f.correction_rate * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-right font-mono text-[12.5px] font-semibold">
                    {pct(f.correction_rate)}
                  </span>
                  <span className="text-right text-[11px] text-ink-secondary">
                    n={f.n}
                  </span>
                </div>
              ))}
              <div className="mt-2 text-[11.5px] leading-[1.5] text-ink-primary">
                <b>
                  A field corrected most of the time is not a reviewer problem
                  — it is a ticket.
                </b>{" "}
                Fix the top row and the queue below it shrinks for free.
              </div>
            </div>
          </div>
        )}
        {metricsQ.isPending && (
          <p className="text-[13px] text-ink-secondary">Reading the nightly compute…</p>
        )}
        {metricsQ.error != null && (
          <p className="text-[13px] text-state-halt">{String(metricsQ.error)}</p>
        )}
      </div>
      {drillSignal !== null && (
        <DrillDrawer signal={drillSignal} onClose={() => setDrillSignal(null)} />
      )}
    </ScreenFrame>
  );
}

function PairCard({
  title,
  aLabel,
  aVal,
  aSub,
  bLabel,
  bVal,
  bAct,
  bSub,
  footnote,
  onDrill,
}: {
  title: string;
  aLabel: string;
  aVal: string;
  aSub: string;
  bLabel: string;
  bVal: string;
  bAct: boolean;
  bSub: string;
  footnote: string;
  onDrill: () => void;
}) {
  return (
    <div className="flex flex-col rounded-md border border-line-strong bg-surface-panel px-4 py-[14px]">
      <div className="text-[10.5px] font-bold tracking-[.08em] text-ink-secondary">
        {title}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-[10px]">
        <div onClick={onDrill} className="cursor-pointer">
          <div className="text-[10.5px] text-ink-secondary">{aLabel}</div>
          <div className="font-mono text-[26px] font-semibold">{aVal}</div>
          <div className="text-[10.5px] text-ink-muted">{aSub}</div>
        </div>
        <div
          className="border-l border-line-subtle pl-2 text-[9.5px] font-bold tracking-[.06em] text-line-dashed"
          style={{ writingMode: "vertical-rl" }}
        >
          READ TOGETHER
        </div>
        <div onClick={onDrill} className="cursor-pointer">
          <div className="text-[10.5px] text-ink-secondary">{bLabel}</div>
          <div
            className={`font-mono text-[26px] font-semibold ${bAct ? "text-state-halt" : ""}`}
          >
            {bVal}
          </div>
          <div className="text-[10.5px] text-ink-muted">{bSub}</div>
        </div>
      </div>
      <div className="mt-[7px] text-[10.5px] leading-[1.45] text-ink-secondary">
        {footnote}
      </div>
    </div>
  );
}

/** In-place expanding drawer — the drill-down is server-authored, verbatim. */
function DrillDrawer({
  signal,
  onClose,
}: {
  signal: string;
  onClose: () => void;
}) {
  const drillQ = useQuery({
    queryKey: ["derived", signal],
    queryFn: () =>
      api(DerivedSignalResponse, `/api/derived/${encodeURIComponent(signal)}`),
  });
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-[rgb(31_28_23/0.45)]"
      />
      <div
        data-testid="drill-drawer"
        className="fixed top-0 right-0 bottom-0 z-[51] flex w-[440px] flex-col border-l border-line-strong bg-surface-panel shadow-pop"
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
          <div className="text-[12px] font-bold tracking-[.06em] text-ink-primary">
            {drillQ.data?.title ?? signal}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent px-2 py-[2px] text-[16px] text-ink-secondary"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {drillQ.data?.note != null && (
            <div className="mb-[10px] text-[11.5px] leading-[1.5] text-ink-secondary">
              {drillQ.data.note}
            </div>
          )}
          {(drillQ.data?.rows ?? []).map((r, i) => (
            <div
              key={i}
              className="mb-[7px] rounded-[5px] border border-line-subtle bg-surface-panel px-3 py-[9px]"
            >
              <div className="font-mono text-[12px] font-semibold">{r.head}</div>
              <div className="mt-[3px] text-[11.5px] leading-[1.45] text-ink-secondary">
                {r.body}
              </div>
              {r.meta !== null && (
                <div className="mt-[5px] text-[10.5px] text-ink-muted">
                  {r.meta}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
