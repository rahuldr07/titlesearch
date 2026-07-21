import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Ack,
  EngineRoutingRequest,
  EnginesResponse,
  LeaderboardResponse,
  RoutingResponse,
  type LeaderboardCell,
} from "@titlepipe/contract";
import { api } from "../api";
import { MutationNote } from "../components/notice";
import { HomeTitle } from "../components/TopBar";

/**
 * Engine Leaderboard (frontend-master-prompt §4.15), to the Engine
 * Leaderboard.dc.html terminal register: engine × section × jurisdiction
 * matrix — per-cell winners ON PURPOSE. There is no best engine, only best
 * for a cell; an aggregate headline would hide exactly the cells that pay.
 *
 * Cells below golden coverage render literally NO TRUTH YET (not a zero).
 * Seat changes demand an EVIDENCE URL (contract-enforced) and show who/when
 * after — config flip, no deploy, NO auto-promotion anywhere. Engines with
 * no capability for a cell declare null and render "—", never a faked score.
 */
export function EngineLeaderboardScreen() {
  const enginesQ = useQuery({
    queryKey: ["engines"],
    queryFn: () => api(EnginesResponse, "/api/engines"),
  });
  const boardQ = useQuery({
    queryKey: ["engines", "leaderboard"],
    queryFn: () => api(LeaderboardResponse, "/api/engines/leaderboard"),
  });
  const routingQ = useQuery({
    queryKey: ["engines", "routing"],
    queryFn: () => api(RoutingResponse, "/api/engines/routing"),
  });
  const [sel, setSel] = useState<{ engine: string; jurisdiction: string; section: string } | null>(null);

  const engines = enginesQ.data?.engines ?? [];
  const cells = boardQ.data?.cells ?? [];
  const routing = routingQ.data?.cells ?? [];

  const columns = [
    ...new Map(
      cells.map((c) => [
        `${c.jurisdiction}|${c.section}`,
        { jurisdiction: c.jurisdiction, section: c.section },
      ]),
    ).values(),
  ];
  const readerA = engines.filter((e) => e.kind === "vlm_image");
  const readerB = engines.filter((e) => e.kind !== "vlm_image");

  const cellOf = (engine: string, col: { jurisdiction: string; section: string }) =>
    cells.find(
      (c) =>
        c.engine_id === engine &&
        c.jurisdiction === col.jurisdiction &&
        c.section === col.section,
    );
  const seatOf = (col: { jurisdiction: string; section: string }) =>
    routing.filter(
      (r) => r.jurisdiction === col.jurisdiction && r.section === col.section,
    );

  const selCell = sel
    ? cellOf(sel.engine, { jurisdiction: sel.jurisdiction, section: sel.section })
    : undefined;

  return (
    <div className="flex h-screen flex-col bg-dk-deep font-mono text-[12px] text-dk-ink-soft">
      <div className="flex flex-none flex-wrap items-baseline gap-[14px] border-b border-dk-line px-[14px] py-2">
        <HomeTitle
          title="ENGINE LEADERBOARD"
          className="text-[11px] font-bold tracking-[.1em] text-ink-dim"
        />
        <span className="text-dk-ink-strong">
          vs golden set · {engines.length} engines enabled
        </span>
        <span className="ml-auto flex gap-[14px]">
          <Link to="/bench" className="text-[11px] no-underline">
            ← bench
          </Link>
          <Link to="/bench/results" className="text-[11px] no-underline">
            prompt results →
          </Link>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-[14px]">
        <div className="max-w-[1250px]">
          {(enginesQ.isPending || boardQ.isPending || routingQ.isPending) && (
            <div className="mb-2 text-[12px] text-ink-dim">loading the board…</div>
          )}
          {(enginesQ.error ?? boardQ.error ?? routingQ.error) != null && (
            <div className="mb-2 text-[12px] text-dk-attend">
              Board unavailable:{" "}
              {String(enginesQ.error ?? boardQ.error ?? routingQ.error)}
            </div>
          )}
          <div className="mb-[6px] text-[11px] font-bold tracking-[.08em] text-ink-dim">
            ENGINE × SECTION × JURISDICTION — PER-CELL WINNERS ON PURPOSE.
            THERE IS NO BEST ENGINE, ONLY BEST FOR A CELL; AN AGGREGATE
            HEADLINE WOULD HIDE EXACTLY THE CELLS THAT PAY.
          </div>
          {/* The matrix gets its own scroll box (both axes) so the header
              row and the engine-label column stay pinned via position:sticky
              — a wide board no longer forces you to lose the row/column you
              are reading. The rest of the page (legend, detail, routing)
              flows below in the outer scroll and reflows on narrow screens. */}
          <div className="max-h-[62vh] overflow-auto">
          <div
            className="grid gap-[2px]"
            style={{
              gridTemplateColumns: `216px repeat(${columns.length}, minmax(102px, 1fr))`,
            }}
          >
            <span className="sticky top-0 left-0 z-30 bg-dk-deep" />
            {columns.map((col) => (
              <div
                key={`${col.jurisdiction}|${col.section}`}
                className={`sticky top-0 z-20 bg-dk-deep px-1 py-1 text-center text-[10.5px] ${
                  col.section === "judgments_liens"
                    ? "text-dk-attend"
                    : "text-ink-dim"
                }`}
              >
                {col.jurisdiction}
                <br />
                {col.section}
              </div>
            ))}
            {[
              { label: "READER A SEAT — vlm_image · failure mode: plausible-but-wrong", list: readerA },
              { label: "READER B SEAT — ocr_text · failure mode: visibly garbled", list: readerB },
            ].map((group) => [
              <div
                key={group.label}
                className="bg-dk-deep py-[6px] pr-2 text-[10px] font-bold tracking-[.06em] text-ink-secondary"
                style={{ gridColumn: `1 / span ${columns.length + 1}` }}
              >
                <span className="sticky left-0">{group.label}</span>
              </div>,
              ...group.list.map((e) => [
                <span
                  key={`${e.id}-label`}
                  className="sticky left-0 z-10 bg-dk-deep py-[5px] pr-2 text-dk-ink"
                >
                  {e.id}
                </span>,
                ...columns.map((col) => {
                  const cell = cellOf(e.id, col);
                  const seated = seatOf(col).some((r) => r.engine_id === e.id);
                  const isSel =
                    sel?.engine === e.id &&
                    sel.jurisdiction === col.jurisdiction &&
                    sel.section === col.section;
                  return (
                    <button
                      key={`${e.id}-${col.jurisdiction}-${col.section}`}
                      type="button"
                      data-testid={`lb-${e.id}-${col.jurisdiction}-${col.section}`}
                      onClick={() =>
                        setSel({
                          engine: e.id,
                          jurisdiction: col.jurisdiction,
                          section: col.section,
                        })
                      }
                      className={`cursor-pointer rounded-[2px] border px-1 py-[5px] text-center font-mono text-[11px] ${
                        isSel
                          ? "border-action-border bg-dk-info-row"
                          : "border-transparent bg-dk-bg"
                      }`}
                    >
                      <CellBody cell={cell} seated={seated} />
                    </button>
                  );
                }),
              ]),
            ])}
          </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-5 text-[10.5px] text-ink-dim">
            <span>
              <b className="text-dk-attend">
                judgments_liens never auto-confirms in v1
              </b>{" "}
              no matter who holds the seat — the seat only decides which draft
              a human reviews
            </span>
            <span>
              <b className="text-action-border">SEAT</b> = where the router
              currently sends that cell
            </span>
            <span>NO TRUTH YET is not a zero — a cell without truth cannot be won</span>
            <span>
              cell codes = first letter of the truth tag:{" "}
              <b className="text-dk-ink-soft">d</b> delivered_report ·{" "}
              <b className="text-dk-ink-soft">r</b> ruled ·{" "}
              <b className="text-dk-ink-soft">a</b> agreed ·{" "}
              <b className="text-dk-ink-soft">s</b> suspect
            </span>
          </div>

          {sel && (
            <DetailPanel
              sel={sel}
              cell={selCell}
              seats={seatOf(sel)}
            />
          )}

          <div className="mt-[14px]">
            <div className="mb-[5px] text-[11px] font-bold tracking-[.08em] text-ink-dim">
              ROUTING — EVERY SEAT IS A PERSON, A TIME, AND EVIDENCE
            </div>
            {routing.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[150px_90px_1fr] gap-3 py-[3px] text-[11px] text-dk-ink-soft"
              >
                <span className="text-ink-secondary">
                  {new Intl.DateTimeFormat("en-US", {
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date(r.approved_at))}{" "}
                  · seat {r.seat}
                </span>
                <span className="text-ink-dim">{r.approved_by}</span>
                <span>
                  {r.jurisdiction} × {r.section}: {r.engine_id} · evidence{" "}
                  {r.evidence_url}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[10.5px] leading-[1.6] text-ink-secondary">
            adding an engine = one adapter (≤300 lines) + one bench run + one
            config flip — no schema, no pipeline change · engines never see
            each other's output; independence is what makes disagreement
            meaningful · self-reported confidence never gates auto-confirm —
            it is one prioritisation signal among several
          </div>
        </div>
      </div>
    </div>
  );
}

function CellBody({
  cell,
  seated,
}: {
  cell: LeaderboardCell | undefined;
  seated: boolean;
}) {
  if (!cell) return <span className="text-dk-line">—</span>;
  if (cell.no_truth_yet) {
    return (
      <span className="text-[10px] tracking-[.04em] text-ink-secondary">
        NO TRUTH YET
      </span>
    );
  }
  if (cell.accuracy_by_tag === null) {
    // capability not declared for this cell — never faked
    return <span className="text-dk-line">—</span>;
  }
  const parts = Object.entries(cell.accuracy_by_tag).map(
    ([tag, v]) => `${tag.slice(0, 1)} ${Math.round(v * 100)}`,
  );
  return (
    <>
      <span className="text-dk-ink-strong">{parts.join(" · ")}</span>
      {seated && (
        <span className="mt-[2px] block text-[9px] font-bold tracking-[.06em] text-action-border">
          SEAT
        </span>
      )}
    </>
  );
}

function DetailPanel({
  sel,
  cell,
  seats,
}: {
  sel: { engine: string; jurisdiction: string; section: string };
  cell: LeaderboardCell | undefined;
  seats: { seat: string; engine_id: string; approved_by: string; approved_at: string; evidence_url: string }[];
}) {
  const queryClient = useQueryClient();
  const [flipSeat, setFlipSeat] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");

  const candidate = flipSeat
    ? {
        jurisdiction: sel.jurisdiction,
        section: sel.section,
        seat: flipSeat,
        engine_id: sel.engine,
        evidence_url: evidence.trim(),
      }
    : null;
  const canFlip =
    candidate !== null && EngineRoutingRequest.safeParse(candidate).success;

  const flip = useMutation({
    mutationFn: () =>
      api(Ack, "/api/engines/routing", {
        method: "POST",
        body: JSON.stringify(candidate),
      }),
    onSuccess: () => {
      setFlipSeat(null);
      setEvidence("");
      void queryClient.invalidateQueries({ queryKey: ["engines", "routing"] });
    },
    onError: () =>
      void queryClient.invalidateQueries({ queryKey: ["engines", "routing"] }),
  });

  return (
    <div className="mt-[14px] flex flex-wrap gap-[18px] rounded-[5px] border border-dk-line bg-dk-bg px-[14px] py-3">
      <div className="min-w-[420px] flex-1">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-[13px] font-bold text-dk-ink-strong">
            {sel.engine} × {sel.jurisdiction} × {sel.section}
          </span>
          {cell?.golden_coverage != null && cell.golden_coverage > 0 && (
            <span className="text-ink-secondary">
              n = {cell.golden_coverage} golden fields
            </span>
          )}
        </div>
        {cell?.no_truth_yet === true && (
          <div className="mt-[10px] max-w-[560px] text-[12px] leading-[1.55] text-ink-dim">
            NO TRUTH YET — golden coverage is below threshold here. A cell
            without truth cannot be won; the fix is coverage, not promotion.
          </div>
        )}
        {cell?.accuracy_by_tag != null && (
          <>
            <div className="mt-[10px] mb-1 text-[11px] font-bold tracking-[.08em] text-ink-dim">
              BY TAG CLASS — THE SPLIT IS THE FINDING
            </div>
            {Object.entries(cell.accuracy_by_tag).map(([tag, v]) => (
              <div
                key={tag}
                className="grid grid-cols-[200px_70px] gap-[10px] py-[2px] text-[11.5px]"
              >
                <span
                  className={
                    tag === "ruled" ? "text-action-border" : "text-dk-ink-soft"
                  }
                >
                  {tag}
                </span>
                <span
                  className={v < 0.7 ? "text-dk-act" : "text-dk-ok"}
                  data-testid={`tag-${tag}`}
                >
                  {Math.round(v * 100)}%
                </span>
              </div>
            ))}
          </>
        )}
        {cell != null && !cell.no_truth_yet && (
          <div className="mt-2 text-[11px] text-ink-dim">
            {cell.cost_per_1k_pages_usd !== null &&
              `$${cell.cost_per_1k_pages_usd.toFixed(2)}/1k pages`}
            {cell.p95_latency_ms !== null &&
              ` · p95 ${(cell.p95_latency_ms / 1000).toFixed(1)}s`}
          </div>
        )}
        {sel.section === "judgments_liens" && (
          <div className="mt-2 inline-block rounded-[3px] border border-dashed border-dk-attend-border px-[9px] py-1 text-[11px] text-dk-attend">
            judgments never auto-confirm in v1 — this seat only decides which
            draft a human reviews
          </div>
        )}
      </div>
      <div className="flex w-[340px] flex-none flex-col gap-[7px] border-l border-dk-line pl-4">
        <div className="text-[11px] font-bold tracking-[.08em] text-ink-dim">
          THE SEATS — WHO HOLDS THIS CELL
        </div>
        {seats.map((s) => (
          <div key={s.seat} data-testid={`seat-${s.seat}`} className="text-[12px]">
            <span className="text-dk-ink-strong">
              {s.seat}: {s.engine_id}
            </span>
            <div className="text-[10.5px] text-ink-dim">
              approved by {s.approved_by} ·{" "}
              {new Intl.DateTimeFormat("en-US", {
                month: "2-digit",
                day: "2-digit",
              }).format(new Date(s.approved_at))}{" "}
              · evidence {s.evidence_url}
            </div>
          </div>
        ))}
        {cell != null && !cell.no_truth_yet && cell.accuracy_by_tag !== null && (
          <>
            {flipSeat === null ? (
              <>
                <div className="flex gap-2">
                  {seats
                    .filter((s) => s.engine_id !== sel.engine)
                    .map((s) => (
                      <button
                        key={s.seat}
                        type="button"
                        data-testid={`flip-${s.seat}`}
                        onClick={() => setFlipSeat(s.seat)}
                        className="cursor-pointer rounded-[3px] border border-neutral bg-transparent px-3 py-[6px] text-left font-mono text-[12px] font-bold text-action-border"
                      >
                        Move seat {s.seat} here
                      </button>
                    ))}
                </div>
                <div className="text-[10.5px] leading-[1.5] text-ink-secondary">
                  no auto-promotion — the leaderboard shows, a person decides.
                  Every flip is logged with evidence.
                </div>
              </>
            ) : (
              <>
                <input
                  data-testid="evidence-input"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="evidence URL — required; a flip without evidence is refused"
                  className="w-full rounded-[3px] border border-neutral bg-dk-card px-[9px] py-[6px] font-mono text-[11.5px] text-dk-ink"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-testid="confirm-flip"
                    disabled={!canFlip || flip.isPending}
                    onClick={() => flip.mutate()}
                    className={`rounded-[3px] border px-[14px] py-[6px] font-mono text-[12px] font-bold ${
                      canFlip
                        ? "cursor-pointer border-action bg-action text-ink-invert"
                        : "cursor-not-allowed border-dashed border-dk-line-2 bg-dk-bg text-ink-secondary"
                    }`}
                  >
                    Confirm flip — logged
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipSeat(null)}
                    className="cursor-pointer rounded-[3px] border border-dk-line-2 bg-transparent px-3 py-[6px] font-mono text-[12px] text-ink-dim"
                  >
                    cancel
                  </button>
                </div>
                <div className="text-[10.5px] leading-[1.5] text-ink-secondary">
                  config flip only — no deploy; the router reads the new
                  assignment on the next order
                </div>
                {flip.error != null && (
                  <MutationNote
                    register="dark"
                    testid="flip-note"
                    error={flip.error}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
