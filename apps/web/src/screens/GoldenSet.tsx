import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { GoldenResponse, type GoldenField } from "@titlepipe/contract";
import { api } from "../api";
import { ScreenFrame, TopBar } from "../components/TopBar";

/**
 * Golden Set (frontend-master-prompt §4.9), to the Golden Set.dc.html pixel
 * spec: the eval, the spec, and the first honest number — all at once.
 * Capture is STRUCTURALLY blind: the pipeline's draft is never on this
 * screen, not greyed out, not behind a toggle. NO TIMERS ANYWHERE.
 *
 * Capture builds a structured fixture locally (the .dc.html ships no capture
 * endpoint by design — "exports fixtures the test suite consumes"). The
 * corpus list + correction flow are contract-backed; the dc's Comparison tab
 * overlaps blind-fifty reconciliation (screen 13) and lives there.
 */

const CAPTURE_FORM: { sec: string; fields: string[] }[] = [
  { sec: "CURRENT OWNER", fields: ["OWNER(S)", "PROPERTY ADDRESS", "ZIP"] },
  { sec: "LEGAL DESCRIPTION", fields: ["LOT", "BLOCK", "PLAT BOOK/PAGE"] },
  { sec: "DEED", fields: ["GRANTOR", "DEED BOOK/PAGE", "CONSIDERATION"] },
  { sec: "MORTGAGES", fields: ["MTG 1 — LENDER", "MTG 1 — AMOUNT"] },
  { sec: "JUDGMENTS & LIENS", fields: ["JGMT 1 — PLAINTIFF", "JGMT 1 — AMOUNT"] },
];

type Special = "dk" | "na";

export function GoldenSetScreen() {
  const [tab, setTab] = useState<"capture" | "corpus">("capture");
  return (
    <ScreenFrame>
      <TopBar
        title="Golden set"
        links={[
          { label: "Bench results", to: "/bench/results" },
          { label: "Blind fifty status", to: "/blind-status" },
        ]}
      >
        <div className="text-[12px] text-ink-secondary">
          the eval, the spec, and the first honest number — all at once
        </div>
        <div className="flex overflow-hidden rounded-sm border border-line-strong">
          <button
            type="button"
            onClick={() => setTab("capture")}
            className={`cursor-pointer border-none px-[14px] py-[5px] font-sans text-[12px] font-semibold ${
              tab === "capture"
                ? "bg-page-ref text-ink-on-action"
                : "bg-surface-panel text-ink-secondary"
            }`}
          >
            Capture
          </button>
          <button
            type="button"
            onClick={() => setTab("corpus")}
            className={`cursor-pointer border-none px-[14px] py-[5px] font-sans text-[12px] font-semibold ${
              tab === "corpus"
                ? "bg-page-ref text-ink-on-action"
                : "bg-surface-panel text-ink-secondary"
            }`}
          >
            Corpus
          </button>
        </div>
      </TopBar>
      {tab === "capture" ? <CaptureTab /> : <CorpusTab />}
    </ScreenFrame>
  );
}

function CaptureTab() {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [special, setSpecial] = useState<Record<string, Special>>({});
  const key = (sec: string, label: string) => `${sec}|${label}`;

  const entries = Object.entries(vals)
    .filter(([, v]) => v.trim() !== "")
    .map(([k, v]) => `"${k.split("|")[1] ?? k}": "${v.trim()}"`)
    .concat(
      Object.entries(special).map(
        ([k, s]) =>
          `"${k.split("|")[1] ?? k}": "${s === "dk" ? "__DONT_KNOW__" : "__NOT_STATED__"}"`,
      ),
    );

  return (
    <>
      <div className="flex-none border-b border-line-strong bg-track px-[18px] py-2 text-[12.5px] text-ink-primary">
        You never see the pipeline's draft here — not greyed out, not behind a
        toggle. A draft you can see is a draft you will agree with, and then
        this measures nothing. You are typing the answer the machine will be
        graded against.
      </div>
      {/* Two-pane capture scrolls horizontally within this region so a narrow
          laptop never scrolls the whole page sideways. */}
      <div className="flex min-h-0 flex-1 overflow-x-auto">
      <div className="flex min-h-0 min-w-[940px] flex-1">
        <div className="flex w-[56%] min-w-[520px] items-center justify-center bg-document-bg p-[22px]">
          <div className="relative aspect-[8.5/11] w-[min(560px,100%)] self-start rounded-[2px] bg-page shadow-page">
            <div className="absolute top-[26px] left-[44px] h-[14px] w-[46%] rounded-[2px] bg-page-bar" />
            <div
              className="absolute top-[52px] right-[44px] bottom-[40px] left-[44px]"
              style={{
                background:
                  "repeating-linear-gradient(to bottom, var(--color-page-line) 0 9px, transparent 9px 22px)",
              }}
            />
            <div className="absolute right-6 bottom-[14px] font-mono text-[10px] text-ink-muted">
              read freely — this is reading, not queue-clearing
            </div>
          </div>
        </div>
        <div className="flex min-w-[420px] flex-1 flex-col border-l border-line-strong bg-surface-panel">
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5">
            {CAPTURE_FORM.map((s) => (
              <div key={s.sec} className="mb-[18px]">
                <div className="mb-[6px] rounded-[3px] bg-track px-[10px] py-1 text-[11px] font-bold tracking-[.1em] text-ink-primary">
                  {s.sec}
                </div>
                {s.fields.map((label) => {
                  const k = key(s.sec, label);
                  const sp = special[k];
                  return (
                    <div
                      key={label}
                      className="grid grid-cols-[150px_minmax(160px,1fr)_auto] items-center gap-2 px-1 py-[5px]"
                    >
                      <span className="text-[10.5px] font-semibold tracking-[.05em] text-ink-secondary">
                        {label}
                      </span>
                      {sp === undefined ? (
                        <>
                          <input
                            data-testid={`golden-${label}`}
                            value={vals[k] ?? ""}
                            onChange={(e) =>
                              setVals((v) => ({ ...v, [k]: e.target.value }))
                            }
                            className="w-full rounded-[3px] border border-line-strong bg-surface-panel px-2 py-1 font-mono text-[12.5px]"
                          />
                          <span className="flex gap-[5px]">
                            <button
                              type="button"
                              title="a rule or training is missing — the most informative answer here"
                              onClick={() =>
                                setSpecial((v) => ({ ...v, [k]: "dk" }))
                              }
                              className="cursor-pointer rounded-[3px] border border-state-attend-border bg-transparent px-2 py-[3px] font-sans text-[10px] font-bold tracking-[.04em] text-state-attend"
                            >
                              DON'T KNOW
                            </button>
                            <button
                              type="button"
                              title="the package doesn't say — renders Not Available, correctly"
                              onClick={() =>
                                setSpecial((v) => ({ ...v, [k]: "na" }))
                              }
                              className="cursor-pointer rounded-[3px] border border-line-strong bg-transparent px-2 py-[3px] font-sans text-[10px] font-bold tracking-[.04em] text-ink-secondary"
                            >
                              NOT STATED
                            </button>
                          </span>
                        </>
                      ) : (
                        <>
                          <span
                            className={`rounded-[3px] border px-2 py-1 font-mono text-[12px] ${
                              sp === "dk"
                                ? "border-state-attend-border bg-state-attend-surface text-state-attend"
                                : "border-line-strong bg-surface-raised text-ink-secondary"
                            }`}
                          >
                            {sp === "dk"
                              ? "? don't know — a rule or training is missing"
                              : "Not Available — the package doesn't say"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSpecial((v) => {
                                const next = { ...v };
                                delete next[k];
                                return next;
                              })
                            }
                            className="cursor-pointer border-none bg-transparent p-0 text-[10.5px] font-semibold text-page-ref"
                          >
                            clear
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex-none border-t border-line-subtle bg-surface-panel px-5 py-[9px]">
            <div className="text-[10px] font-bold tracking-[.08em] text-ink-secondary">
              WHAT YOU ARE BUILDING — STRUCTURED FROM THE FIRST KEYSTROKE
            </div>
            <div
              data-testid="fixture-line"
              className="mt-1 overflow-hidden font-mono text-[11px] text-ellipsis whitespace-nowrap text-ink-secondary"
            >
              {`{ ${entries.join(", ")} }`}
            </div>
            <div className="mt-[3px] text-[10.5px] text-ink-muted">
              → consumed by the test suite directly. No transcription step, no
              Word document, no new source of error.
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

const tagChip: Record<GoldenField["tag"], string> = {
  delivered_report:
    "border border-state-attend-border bg-state-attend-surface text-state-attend",
  ruled: "border border-page-ref-border bg-page-ref-surface text-page-ref",
  suspect: "border border-line-dashed bg-surface-raised text-ink-secondary",
  agreed: "border border-state-settled-border bg-state-settled-surface text-state-settled",
};

function CorpusTab() {
  const goldenQ = useQuery({
    queryKey: ["golden"],
    queryFn: () => api(GoldenResponse, "/api/golden"),
  });
  return (
    <div className="flex-1 overflow-y-auto px-[22px] pt-[18px] pb-[60px]">
      <div className="mx-auto max-w-[900px]">
        <div className="text-[12.5px] text-ink-secondary">
          Provenance-tagged ground truth. Tags say what to trust:{" "}
          <b>delivered_report</b> is anchored on typist behaviour, not truth —
          which is why the blind fifty still has to happen.
        </div>
        {goldenQ.isPending && (
          <p className="mt-2 text-[13px] text-ink-secondary">Fetching the corpus…</p>
        )}
        {goldenQ.error != null && (
          <p className="mt-2 text-[13px] text-state-halt">
            Corpus unavailable: {String(goldenQ.error)}
          </p>
        )}
        {(goldenQ.data?.golden_fields ?? []).map((g) => (
          <div
            key={g.id}
            data-testid={`golden-row-${g.id}`}
            className="mt-[10px] rounded-md border border-line-strong bg-surface-panel px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-[10px]">
                <span className="font-mono text-[12.5px] font-semibold">
                  {g.path}
                </span>
                <span className="font-mono text-[12.5px] text-ink-secondary">
                  {g.value ?? "Not Available"}
                </span>
                <span
                  className={`rounded-xs px-[6px] py-px text-[9.5px] font-bold tracking-[.05em] ${tagChip[g.tag]}`}
                >
                  {g.tag.toUpperCase()}
                </span>
              </div>
              <Link
                to="/seed-correction"
                search={{ fieldId: g.id }}
                className="text-[11px] font-semibold no-underline"
              >
                investigate →
              </Link>
            </div>
            {g.corrected_at !== null && (
              <div className="mt-[5px] text-[11px] text-ink-secondary">
                corrected {g.corrected_from ?? "—"} → {g.value ?? "—"} ·{" "}
                {g.corrected_by} · “{g.correction_reason}” — permanent, on the
                record
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
