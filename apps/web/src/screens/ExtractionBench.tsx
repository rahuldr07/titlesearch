import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BenchResultsResponse, RulesResponse } from "@titlepipe/contract";
import { api } from "../api";
import { HomeTitle } from "../components/TopBar";

/**
 * Extraction Bench (frontend-master-prompt §4.10), to the Extraction
 * Bench.dc.html terminal register: scan / prompt / output-vs-truth / grid
 * panes; cost per run visible; NO auto-tune affordance — the loop is a human
 * understanding why the model was wrong.
 *
 * The prompt pane renders the RuleContext honestly: prompts are GENERATED
 * from the live rulebook (GET /api/rules); a rule change propagates to every
 * engine, no per-engine prompt surgery. Run/grid execution and prompt
 * versioning have no contract endpoints yet (CONTRACT GAP) — those controls
 * render inert; output-vs-truth reads the latest bench results.
 */
export function ExtractionBenchScreen() {
  const [zoom, setZoom] = useState(100);
  const rulesQ = useQuery({
    queryKey: ["rules"],
    queryFn: () => api(RulesResponse, "/api/rules"),
  });
  const resultsQ = useQuery({
    queryKey: ["bench", "results"],
    queryFn: () => api(BenchResultsResponse, "/api/bench/results"),
  });

  const liveRules = (rulesQ.data?.rules ?? []).filter(
    (r) => r.status === "live",
  );
  const mortgages = resultsQ.data?.sections.find(
    (s) => s.section === "mortgages",
  );

  return (
    <div className="flex h-screen flex-col bg-dk-deep font-mono text-[12px] text-dk-ink-soft">
      <div className="flex flex-none flex-wrap items-center gap-4 border-b border-dk-line px-[14px] py-[7px]">
        <HomeTitle
          title="EXTRACTION BENCH"
          className="text-[11px] font-bold tracking-[.1em] text-ink-dim"
        />
        <span className="text-ink-secondary">doc type:</span>
        <span className="font-semibold text-dk-ink-strong">Security Deed</span>
        <span className="ml-auto text-ink-secondary">
          session cost: <b className="text-dk-attend">—</b> · runs land when
          the bench endpoints ship
        </span>
        <Link to="/leaderboard" className="text-[11px] no-underline">
          engines →
        </Link>
        <Link to="/bench/results" className="text-[11px] no-underline">
          results →
        </Link>
      </div>
      {(rulesQ.error ?? resultsQ.error) != null && (
        <div className="flex-none border-b border-dk-line px-[14px] py-[6px] text-[11.5px] text-dk-attend">
          Bench data unavailable: {String(rulesQ.error ?? resultsQ.error)}
        </div>
      )}
      <div className="flex min-h-0 min-w-[1280px] flex-1">
        {/* scan pane */}
        <div className="flex w-[42%] min-w-[480px] flex-col border-r border-dk-line">
          <div className="flex flex-none flex-wrap items-center gap-[10px] border-b border-dk-line px-[14px] py-[6px]">
            <span className="font-semibold text-dk-ink-strong">
              worst-page scan
            </span>
            <span className="text-ink-secondary">degraded fax · 200 dpi</span>
            <span className="ml-auto flex items-center gap-[6px]">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(60, z - 25))}
                className="cursor-pointer rounded-[3px] border border-dk-line-2 bg-dk-card px-2 py-px text-dk-ink-soft"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(220, z + 25))}
                className="cursor-pointer rounded-[3px] border border-dk-line-2 bg-dk-card px-2 py-px text-dk-ink-soft"
              >
                +
              </button>
              <span className="text-ink-secondary">{zoom}%</span>
            </span>
          </div>
          <div className="flex flex-1 justify-center overflow-auto p-4">
            <div
              className="relative flex-none self-start rounded-[1px] bg-scan shadow-page"
              style={{
                width: `${Math.round(4.6 * zoom)}px`,
                aspectRatio: "8.5/11",
                filter: "contrast(1.2) brightness(.95)",
              }}
            >
              <div className="absolute top-5 left-[34px] h-[11px] w-[48%] bg-line-strong" />
              <div
                className="absolute top-[42px] right-[34px] bottom-[30px] left-[34px]"
                style={{
                  background:
                    "repeating-linear-gradient(to bottom, var(--color-scan-line-lt) 0 7px, transparent 7px 17px)",
                }}
              />
              <div className="absolute top-[8%] right-[6%] h-[54px] w-[130px] rotate-[-2deg] border-2 border-ink-dim p-1 text-[8px] text-label">
                RECORDING STAMP
              </div>
            </div>
          </div>
          <div className="flex-none border-t border-dk-line px-[14px] py-[7px] text-[11px] text-ink-dim">
            page triage: ~90% of pages carry no fields — the grid cost is why
            that matters. Two-stage extraction is the cost valve, never an
            accuracy lever.
          </div>
        </div>
        {/* prompt + truth + grid */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex-none border-b border-dk-line px-[14px] py-[10px]">
            <div className="mb-[6px] flex flex-wrap items-center gap-[10px]">
              <span className="text-[11px] font-bold tracking-[.08em] text-ink-dim">
                PROMPT — GENERATED FROM THE RULEBOOK
              </span>
              <span className="text-[10.5px] text-ink-secondary">
                a rule change propagates to every engine, no per-engine prompt
                surgery
              </span>
              <button
                type="button"
                disabled
                title="bench-run endpoints are a CONTRACT GAP — runs land with the FastAPI port"
                className="cursor-not-allowed rounded-[3px] border border-dashed border-dk-line-2 bg-dk-bg px-4 py-1 font-mono text-[12px] font-bold text-ink-secondary"
              >
                Run — no endpoint yet
              </button>
              <span className="text-[11px] text-ink-secondary">
                cost per run renders here — recorded per call, per engine
              </span>
            </div>
            <div
              data-testid="rulecontext"
              className="max-h-[140px] overflow-y-auto rounded-btn border border-dk-line-2 bg-dk-bg px-[11px] py-[9px] text-[12px] leading-[1.55] text-dk-ink"
            >
              {liveRules.length === 0 ? (
                <span className="text-ink-secondary">rulebook loading…</span>
              ) : (
                liveRules.map((r) => (
                  <div key={r.id}>
                    <span className="text-action-border">{r.code}</span>{" "}
                    {r.text}
                  </div>
                ))
              )}
            </div>
            <div className="mt-[6px] text-[10.5px] text-ink-secondary">
              PENDING rules are absent from this prompt by construction — they
              cannot affect the pipeline until an engineer confirms.
            </div>
          </div>
          <div className="flex-none border-b border-dk-line px-[14px] py-[10px]">
            <div className="mb-[6px] text-[11px] font-bold tracking-[.08em] text-ink-dim">
              OUTPUT vs TRUTH — LATEST BENCH RUN, MORTGAGES SECTION
            </div>
            {(mortgages?.fails ?? []).map((f) => (
              <div
                key={f.path}
                className="grid grid-cols-[minmax(140px,auto)_minmax(180px,1.4fr)_minmax(150px,1fr)] items-baseline gap-[10px] border-b border-dk-card py-[5px]"
              >
                <span className="text-ink-dim">{f.path}</span>
                <span className="truncate text-dk-act">{f.model_value}</span>
                <span className="truncate text-dk-ok">{f.seed_value}</span>
              </div>
            ))}
            <div className="mt-[5px] text-[10.5px] text-ink-secondary">
              model output red, seed green — read the disagreement, then read
              the page. Full matrix in results →
            </div>
          </div>
          <div className="flex-none px-[14px] py-[10px]">
            <div className="mb-[6px] text-[11px] font-bold tracking-[.08em] text-ink-dim">
              SAME PROMPT, EVERY PACKAGE — THE REASON THIS SCREEN EXISTS
            </div>
            <div className="rounded-btn border border-dashed border-dk-line-2 px-[14px] py-4 text-[11.5px] text-ink-secondary">
              cross-package grid (column = jurisdiction problem, row = prompt
              problem) lands with the bench-run endpoints — CONTRACT GAP. The
              reading stays the same: ✗ down a column is the input's fault; ✗
              across a row is the prompt's.
            </div>
            <div className="mt-[6px] text-[10.5px] text-ink-secondary">
              no aggregate headline on purpose — “94% across all fields” hides
              the one field at 30% that ships defects · no auto-tune: the loop
              is a human understanding why the model was wrong
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
