import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BenchResultsResponse,
  type BenchFailRow,
  type BenchSection,
} from "@titlepipe/contract";
import { api } from "../api";
import { HomeTitle } from "../components/TopBar";

/**
 * Bench Results (frontend-master-prompt §4.11), to the Bench
 * Results.dc.html terminal register: section × tag matrix — ruled failures
 * hot red (always actionable), suspect amber (may be the seed, not the
 * model), judgment cells annotated thin.
 *
 * Deliberate deviation: the .dc.html header showed "123/131 · 93.9%" — an
 * aggregate headline. §0.4 forbids one; the axes are the finding, so only
 * the denominators render. Read-only by design — fixes happen in the code.
 */
export function BenchResultsScreen() {
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const resultsQ = useQuery({
    queryKey: ["bench", "results"],
    queryFn: () => api(BenchResultsResponse, "/api/bench/results"),
  });
  const data = resultsQ.data;
  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-document-deep font-mono text-[12px] text-document-ink-soft">
        {resultsQ.error != null ? String(resultsQ.error) : "reading the bench…"}
      </div>
    );
  }

  const TAGS = ["delivered_report", "ruled", "suspect"] as const;
  const tagInk: Record<string, string> = {
    delivered_report: "text-document-settled",
    ruled: "text-document-accent",
    suspect: "text-document-attend",
  };
  const sections = [...new Set(data.cells.map((c) => c.section))];
  const shown = data.sections.filter(
    (s) => filter === "all" || s.section === filter,
  );

  return (
    <div className="flex h-screen flex-col bg-document-deep font-mono text-[12px] text-document-ink-soft">
      <div className="flex flex-none flex-wrap items-baseline gap-4 border-b border-document-line px-[14px] py-2">
        <HomeTitle
          title="BENCH RESULTS"
          className="text-[11px] font-bold tracking-[.1em] text-document-ink-soft"
        />
        <span className="text-document-ink-strong">
          {data.run_ref} · {data.seed_version} · {data.total_fields} fields ·{" "}
          {data.orders} real orders
        </span>
        <Link to="/bench" className="ml-auto text-[11px] no-underline">
          ← bench
        </Link>
        <Link to="/leaderboard" className="text-[11px] no-underline">
          engine leaderboard →
        </Link>
      </div>
      {/* The section×tag matrix has a fixed minimum width; it scrolls WITHIN
          this region (overflow-auto) so a narrow laptop never scrolls the
          whole page sideways. min-w lives on the content, not the viewport. */}
      <div className="flex-1 overflow-auto p-[14px]">
        <div className="min-w-[1152px]">
          <div className="mb-[6px] text-[11px] font-bold tracking-[.08em] text-document-ink-soft">
            SECTION × TAG. THE TWO AXES ARE THE FINDING; NO SINGLE NUMBER IS.
          </div>
          <div className="grid grid-cols-[150px_repeat(3,minmax(150px,1fr))_110px] gap-[2px]">
            <span />
            {TAGS.map((t) => (
              <span
                key={t}
                className={`py-1 text-center text-[10.5px] ${tagInk[t]}`}
              >
                {t}
              </span>
            ))}
            <span className="py-1 text-center text-[10.5px] text-document-ink-soft">
              section
            </span>
            {sections.map((secName) => {
              const secData = data.sections.find((s) => s.section === secName);
              const suspectSec = secData?.suspect_note !== null && secData !== undefined;
              return [
                <span
                  key={`${secName}-label`}
                  className={`py-[5px] pr-[6px] ${suspectSec ? "font-bold text-document-attend" : "text-document-ink-soft"}`}
                >
                  {secName}
                </span>,
                ...TAGS.map((tag) => {
                  const cell = data.cells.find(
                    (c) => c.section === secName && c.tag === tag,
                  );
                  if (!cell) {
                    return (
                      <span
                        key={`${secName}-${tag}`}
                        className="rounded-[2px] bg-document-bg py-[5px] text-center text-document-line"
                      >
                        —
                      </span>
                    );
                  }
                  const failCount = cell.fields - cell.passed;
                  const cls =
                    failCount === 0
                      ? "text-document-settled"
                      : tag === "suspect"
                        ? "border border-dashed border-document-attend-border text-document-attend"
                        : tag === "ruled"
                          ? "bg-document-halt-surface font-bold text-document-halt"
                          : "text-document-halt";
                  return (
                    <span
                      key={`${secName}-${tag}`}
                      data-testid={`cell-${secName}-${tag}`}
                      className={`rounded-[2px] bg-document-bg py-[5px] text-center ${cls}`}
                    >
                      {cell.fields}f · {cell.passed}/{cell.fields}
                    </span>
                  );
                }),
                <span
                  key={`${secName}-tot`}
                  className="py-[5px] text-center text-document-ink-soft"
                >
                  {secData ? `${secData.passed}/${secData.n}` : "—"}
                </span>,
              ];
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-5 text-[10.5px] text-document-ink-soft">
            <span>
              <b className="text-document-attend">judgments_liens × suspect</b> is
              the cell to learn to ignore until the blind fifty lands — 3 of 7
              known defects live in that seed source
            </span>
            <span>
              <b className="text-document-accent">ruled</b> failures are always
              actionable — the seed is authoritative there
            </span>
            <span>
              location.zip is ORDER_SUPPLIED — absent from this screen and
              every denominator, not greyed, not zero
            </span>
          </div>

          <div className="mt-4 mb-[10px] flex flex-wrap items-center gap-[6px]">
            <span className="text-[10.5px] tracking-[.06em] text-document-ink-soft">
              FILTER
            </span>
            {["all", ...sections].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`cursor-pointer rounded-[3px] border bg-transparent px-[10px] py-[2px] font-mono text-[11px] ${
                  filter === f
                    ? "border-document-accent-border text-document-ink-strong"
                    : "border-document-line text-document-ink-soft"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {shown.map((sec) => (
            <SectionBlock
              key={sec.section}
              sec={sec}
              expanded={expanded}
              onToggle={(p) => setExpanded(expanded === p ? null : p)}
            />
          ))}
          <div className="mt-[6px] text-[10.5px] text-document-ink-soft">
            read-only — fixes happen in the code, not here · no run-over-run
            delta on purpose: the seed is the comparand, not last time
          </div>
        </div>
      </div>
    </div>
  );
}

function tagChip(tag: BenchFailRow["tag"]): string {
  const base = "rounded-[3px] px-[7px] py-px text-[10px] whitespace-nowrap justify-self-start ";
  if (tag === "ruled") return base + "border border-state-idle text-document-accent";
  if (tag === "suspect")
    return base + "border border-dashed border-document-attend-border text-document-attend";
  return base + "border border-document-settled-border text-document-settled";
}

function SectionBlock({
  sec,
  expanded,
  onToggle,
}: {
  sec: BenchSection;
  expanded: string | null;
  onToggle: (path: string) => void;
}) {
  return (
    <div className="mb-[14px]">
      <div className="flex flex-wrap items-baseline gap-3 rounded-[3px] bg-document-bg px-2 py-1">
        <span className="font-bold text-document-ink-strong">{sec.section}</span>
        <span className="text-document-ink-soft">
          {sec.passed}/{sec.n} pass
          {sec.note !== null ? ` · ${sec.note}` : ""}
        </span>
        {sec.suspect_note !== null && (
          <span className="rounded-[3px] border border-dashed border-document-attend-border px-2 py-px text-[10.5px] text-document-attend">
            {sec.suspect_note}
          </span>
        )}
      </div>
      {sec.fails.map((f) => {
        const exp = expanded === f.path;
        const suspect = f.tag === "suspect";
        return (
          <div key={f.path}>
            <div
              data-testid={`fail-${f.path}`}
              onClick={() => onToggle(f.path)}
              className={`mt-[2px] grid cursor-pointer grid-cols-[16px_minmax(180px,auto)_minmax(70px,auto)_1fr] items-baseline gap-[10px] rounded-[3px] px-2 py-1 ${
                exp ? "bg-document-card" : ""
              }`}
            >
              <span
                className={`w-4 flex-none ${suspect ? "text-document-attend" : "font-bold text-document-halt"}`}
              >
                ✗
              </span>
              <span className="truncate text-document-ink-soft">{f.path}</span>
              <span className={tagChip(f.tag)}>{f.tag}</span>
              <span
                className={`truncate text-[10.5px] ${
                  f.tag === "ruled"
                    ? "font-bold text-document-halt"
                    : suspect
                      ? "text-document-attend"
                      : "text-document-halt"
                }`}
              >
                {f.tag === "ruled"
                  ? "FAIL — ruled seed, always actionable"
                  : suspect
                    ? "FAIL? — suspect seed; may be the seed, not the model"
                    : "FAIL"}
              </span>
            </div>
            {exp && (
              <div className="mb-[3px] grid grid-cols-[110px_1fr] gap-x-3 gap-y-[6px] border-l-2 border-document-line-strong bg-document-bg py-2 pr-3 pl-[34px] text-[11.5px]">
                <span className="text-document-ink-soft">model</span>
                <span className="text-document-halt">{f.model_value ?? "∅"}</span>
                <span className="text-document-ink-soft">seed</span>
                <span className="text-document-settled">{f.seed_value ?? "∅"}</span>
                <span className="text-document-ink-soft">tag</span>
                <span>{f.tag}</span>
                <span className="text-document-ink-soft">source</span>
                <span className="text-document-ink-soft">{f.source_note}</span>
                {f.golden_field_id !== null && (
                  <>
                    <span />
                    <span>
                      <Link
                        to="/seed-correction"
                        search={{ fieldId: f.golden_field_id }}
                        className="text-[11px] no-underline"
                      >
                        Investigate seed →
                      </Link>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
      {sec.passed > 0 && (
        <div className="px-2 py-1 text-[11px] text-document-ink-soft">
          {sec.passed} passing — collapsed; passes take no space
        </div>
      )}
    </div>
  );
}
