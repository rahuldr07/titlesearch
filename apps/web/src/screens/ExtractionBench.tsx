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
    <div className="flex h-screen flex-col bg-document-deep font-mono text-[12px] text-document-ink-soft">
      <div className="flex flex-none flex-wrap items-center gap-4 border-b border-document-line px-[14px] py-[7px]">
        <HomeTitle
          title="EXTRACTION BENCH"
          className="text-[11px] font-bold tracking-[.1em] text-document-ink-soft"
        />
        <span className="text-document-ink-soft">doc type:</span>
        <span className="font-semibold text-document-ink-strong">Security Deed</span>
        <span className="ml-auto text-document-ink-soft">
          session cost: <b className="text-document-attend">—</b> · runs land when
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
        <div className="flex-none border-b border-document-line px-[14px] py-[6px] text-[11.5px] text-document-attend">
          Bench data unavailable: {String(rulesQ.error ?? resultsQ.error)}
        </div>
      )}
      <div className="flex min-h-0 min-w-[1280px] flex-1">
        {/* scan pane */}
        <div className="flex w-[42%] min-w-[480px] flex-col border-r border-document-line">
          <div className="flex flex-none flex-wrap items-center gap-[10px] border-b border-document-line px-[14px] py-[6px]">
            <span className="font-semibold text-document-ink-strong">
              worst-page scan
            </span>
            <span className="text-document-ink-soft">degraded fax · 200 dpi</span>
            <span className="ml-auto flex items-center gap-[6px]">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(60, z - 25))}
                className="cursor-pointer rounded-[3px] border border-document-line-strong bg-document-card px-2 py-px text-document-ink-soft"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(220, z + 25))}
                className="cursor-pointer rounded-[3px] border border-document-line-strong bg-document-card px-2 py-px text-document-ink-soft"
              >
                +
              </button>
              <span className="text-document-ink-soft">{zoom}%</span>
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
                    "repeating-linear-gradient(to bottom, var(--color-scan-line-soft) 0 7px, transparent 7px 17px)",
                }}
              />
              <div className="absolute top-[8%] right-[6%] h-[54px] w-[130px] rotate-[-2deg] border-2 border-document-line-strong p-1 text-[8px] text-document-ink-soft">
                RECORDING STAMP
              </div>
            </div>
          </div>
          <div className="flex-none border-t border-document-line px-[14px] py-[7px] text-[11px] text-document-ink-soft">
            page triage: ~90% of pages carry no fields — the grid cost is why
            that matters. Two-stage extraction is the cost valve, never an
            accuracy lever.
          </div>
        </div>
        {/* prompt + truth + grid */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex-none border-b border-document-line px-[14px] py-[10px]">
            <div className="mb-[6px] flex flex-wrap items-center gap-[10px]">
              <span className="text-[11px] font-bold tracking-[.08em] text-document-ink-soft">
                PROMPT — GENERATED FROM THE RULEBOOK
              </span>
              <span className="text-[10.5px] text-document-ink-soft">
                a rule change propagates to every engine, no per-engine prompt
                surgery
              </span>
              <button
                type="button"
                disabled
                title="bench-run endpoints are a CONTRACT GAP — runs land with the FastAPI port"
                className="cursor-not-allowed rounded-[3px] border border-dashed border-document-line-strong bg-document-bg px-4 py-1 font-mono text-[12px] font-bold text-document-ink-soft"
              >
                Run — no endpoint yet
              </button>
              <span className="text-[11px] text-document-ink-soft">
                cost per run renders here — recorded per call, per engine
              </span>
            </div>
            <div
              data-testid="rulecontext"
              className="max-h-[140px] overflow-y-auto rounded-sm border border-document-line-strong bg-document-bg px-[11px] py-[9px] text-[12px] leading-[1.55] text-document-ink"
            >
              {liveRules.length === 0 ? (
                <span className="text-document-ink-soft">rulebook loading…</span>
              ) : (
                liveRules.map((r) => (
                  <div key={r.id}>
                    <span className="text-document-accent">{r.code}</span>{" "}
                    {r.text}
                  </div>
                ))
              )}
            </div>
            <div className="mt-[6px] text-[10.5px] text-document-ink-soft">
              PENDING rules are absent from this prompt by construction — they
              cannot affect the pipeline until an engineer confirms.
            </div>
          </div>
          <div className="flex-none border-b border-document-line px-[14px] py-[10px]">
            <div className="mb-[6px] text-[11px] font-bold tracking-[.08em] text-document-ink-soft">
              OUTPUT vs TRUTH — LATEST BENCH RUN, MORTGAGES SECTION
            </div>
            {(mortgages?.fails ?? []).map((f) => (
              <div
                key={f.path}
                className="grid grid-cols-[minmax(140px,auto)_minmax(180px,1.4fr)_minmax(150px,1fr)] items-baseline gap-[10px] border-b border-document-card py-[5px]"
              >
                <span className="text-document-ink-soft">{f.path}</span>
                <span className="truncate text-document-halt">{f.model_value}</span>
                <span className="truncate text-document-settled">{f.seed_value}</span>
              </div>
            ))}
            <div className="mt-[5px] text-[10.5px] text-document-ink-soft">
              model output red, seed green — read the disagreement, then read
              the page. Full matrix in results →
            </div>
          </div>
          <div className="flex-none px-[14px] py-[10px]">
            <div className="mb-[6px] text-[11px] font-bold tracking-[.08em] text-document-ink-soft">
              SAME PROMPT, EVERY PACKAGE — THE REASON THIS SCREEN EXISTS
            </div>
            <div className="rounded-sm border border-dashed border-document-line-strong px-[14px] py-4 text-[11.5px] text-document-ink-soft">
              cross-package grid (column = jurisdiction problem, row = prompt
              problem) lands with the bench-run endpoints — CONTRACT GAP. The
              reading stays the same: ✗ down a column is the input's fault; ✗
              across a row is the prompt's.
            </div>
            <div className="mt-[6px] text-[10.5px] text-document-ink-soft">
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
