import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import {
  Ack,
  GoldenCorrectionRequest,
  GoldenResponse,
  type GoldenField,
} from "@titlepipe/contract";
import { api } from "../api";

/**
 * Seed Correction (frontend-master-prompt §4.9), to the Seed
 * Correction.dc.html pixel spec — terminal register, deliberately spare: the
 * only place in the system where ground truth changes. One field, one
 * document, one record. No bulk operations exist.
 *
 * Correct-seed is contract-enforced (§0.5): value + CITATION + REASON +
 * SIGNATURE or the button stays dead — a correction with no source is an
 * opinion. Tag upgrades to `ruled`; the prior value survives forever in the
 * permanent log.
 *
 * Confirm-seed and demote-to-suspect have NO contract endpoints yet
 * (CONTRACT GAP) — they render as the designed actions but stay inert.
 *
 * There is deliberately NO menu entry and no picker here: you arrive only by
 * expanding a failing bench cell (or a golden row) and clicking Investigate —
 * context-carrying navigation; you land already knowing which field.
 */
export function SeedCorrectionScreen() {
  const search = useSearch({ from: "/seed-correction" });
  const goldenQ = useQuery({
    queryKey: ["golden"],
    queryFn: () => api(GoldenResponse, "/api/golden"),
  });
  const fields = goldenQ.data?.golden_fields ?? [];
  const field =
    search.fieldId !== undefined
      ? (fields.find((g) => g.id === search.fieldId) ?? null)
      : null;

  return (
    <div className="flex h-screen flex-col bg-dk-deep font-mono text-[12px] text-dk-ink-soft">
      <div className="flex flex-none flex-wrap items-baseline gap-4 border-b border-dk-line px-[14px] py-2">
        <span className="text-[11px] font-bold tracking-[.1em] text-ink-dim">
          SEED CORRECTION
        </span>
        {field && (
          <span className="text-dk-ink-strong">{field.path}</span>
        )}
        <span className="text-ink-secondary">
          the only place in the system where ground truth changes — one field,
          one document, one record. No bulk operations exist.
        </span>
        <Link
          to="/bench/results"
          className="ml-auto text-[11px] text-action-border no-underline"
        >
          ← bench results
        </Link>
      </div>
      <div className="flex min-h-0 flex-1">
        <ScanPane />
        <div className="min-w-[560px] flex-1 overflow-y-auto px-[18px] pt-[14px] pb-10">
          {field ? (
            <Investigation key={field.id} field={field} />
          ) : (
            !goldenQ.isPending && (
              <div
                data-testid="no-context"
                className="mt-8 max-w-[480px] rounded-[6px] border-[1.5px] border-dashed border-dk-line-2 px-7 py-8 text-center"
              >
                <div className="mb-3 font-mono text-[20px] text-label">
                  — no field —
                </div>
                <div className="text-[13px] font-semibold text-dk-ink">
                  This screen has no menu entry.
                </div>
                <div className="mt-2 text-[12px] leading-[1.6] text-ink-dim">
                  You reach it by expanding a failing cell in{" "}
                  <Link to="/bench/results" className="no-underline">
                    bench results
                  </Link>{" "}
                  and clicking “Investigate seed” — arriving already knowing
                  which field, which run, which triage note. One field, one
                  document, one record.
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function ScanPane() {
  const [zoom, setZoom] = useState(100);
  return (
    <div className="flex w-[46%] min-w-[520px] flex-col border-r border-dk-line">
      <div className="flex flex-none flex-wrap items-center gap-[10px] border-b border-dk-line px-[14px] py-[6px]">
        <span className="font-semibold text-dk-ink-strong">seed package scan</span>
        <span className="text-ink-secondary">
          degraded fax — the typist read a worse copy of this; the document is
          the only authority now
        </span>
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
      <div className="flex flex-1 justify-center overflow-auto p-[18px]">
        <div
          className="relative flex-none self-start rounded-[1px] bg-scan shadow-page"
          style={{
            width: `${Math.round(4.8 * zoom)}px`,
            aspectRatio: "8.5/11",
            filter: "contrast(1.3) brightness(.94)",
          }}
        >
          <div className="absolute top-[22px] left-[36px] h-[11px] w-[48%] bg-dash" />
          <div
            className="absolute top-[44px] right-[36px] bottom-[32px] left-[36px]"
            style={{
              background:
                "repeating-linear-gradient(to bottom, var(--color-scan-line) 0 7px, transparent 7px 17px)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(87deg, rgb(0 0 0 / 0.06) 0 1px, transparent 1px 5px), repeating-linear-gradient(1deg, rgb(0 0 0 / 0.05) 0 1px, transparent 1px 8px)",
            }}
          />
          <div className="absolute top-[8%] right-[6%] h-[52px] w-[126px] rotate-[-2deg] border-2 border-ink-dim p-1 text-[8px] text-label">
            RECORDING STAMP
          </div>
          <div className="absolute top-[40%] left-[9%] flex w-[82%] border-2 border-act bg-hl-bg">
            <span className="px-[5px] py-[3px] text-[10px] leading-[1.4] text-ink">
              …principal sum of Two Hundred Twenty Thousand Two Hundred
              Twenty-Four Dollars ($2Z0,224.00)…
            </span>
          </div>
        </div>
      </div>
      <div className="flex-none border-t border-dk-line px-[14px] py-[7px] text-[11px] text-ink-dim">
        the amount in words is legible where the numerals are not — §5: words
        win over numerals when the two disagree
      </div>
    </div>
  );
}

function Investigation({ field }: { field: GoldenField }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [cite, setCite] = useState("");
  const [reason, setReason] = useState("");
  const [signed, setSigned] = useState("");

  const candidate = {
    golden_field_id: field.id,
    corrected_value: value.trim() === "" ? null : value.trim(),
    source_citation: cite.trim(),
    reason: reason.trim(),
    signed_by: signed.trim(),
  };
  // The contract schema is the gate — no source, no signature, no correction.
  const canCorrect = GoldenCorrectionRequest.safeParse(candidate).success;

  const correct = useMutation({
    mutationFn: () =>
      api(Ack, "/api/golden/corrections", {
        method: "POST",
        body: JSON.stringify(candidate),
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["golden"] }),
  });

  const corrected = field.corrected_at !== null;

  return (
    <>
      <div className="grid grid-cols-[170px_1fr] gap-x-[14px] gap-y-[5px] rounded-btn border border-dk-line bg-dk-bg px-[14px] py-3">
        <span className="text-ink-secondary">field</span>
        <span className="font-semibold text-dk-ink-strong">{field.path}</span>
        <span className="text-ink-secondary">current seed value</span>
        <span className="text-dk-ok" data-testid="seed-value">
          {field.value ?? "Not Available"}
        </span>
        <span className="text-ink-secondary">source tag</span>
        <span className="text-dk-ok" data-testid="seed-tag">
          {field.tag}
        </span>
        {field.source_citation !== null && (
          <>
            <span className="text-ink-secondary">citation</span>
            <span>{field.source_citation}</span>
          </>
        )}
      </div>

      {!corrected && (
        <>
          <div className="mt-4 mb-2 text-[11px] font-bold tracking-[.08em] text-ink-dim">
            THREE ACTIONS. NOTHING ELSE.
          </div>
          <div className="mb-2 rounded-[5px] border border-dk-card bg-dk-bg px-[14px] py-3">
            <span className="font-bold text-dk-ok">1 · Confirm seed</span>{" "}
            <span className="text-ink-dim">
              the seed is correct — the model failure is real.{" "}
              <i>No endpoint in the contract yet (CONTRACT GAP) — inert.</i>
            </span>
          </div>
          <div className="mb-2 rounded-[5px] border border-dk-attend-border bg-dk-bg px-[14px] py-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-bold text-dk-attend">2 · Correct seed</span>
              <span className="text-ink-dim">
                the seed is wrong. Tag upgrades to{" "}
                <b className="text-action-border">ruled</b>. Logged with your
                name. Permanent.
              </span>
            </div>
            <div className="mt-[10px] grid grid-cols-[130px_1fr] items-center gap-x-3 gap-y-2">
              <span className="text-ink-secondary">correct value</span>
              <input
                data-testid="seed-new-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="max-w-[220px] rounded-btn border border-dk-line-2 bg-dk-card px-[10px] py-[7px] font-mono text-[12.5px] text-dk-ink"
              />
              <span className="text-ink-secondary">citation</span>
              <input
                data-testid="seed-cite"
                value={cite}
                onChange={(e) => setCite(e.target.value)}
                placeholder="document and page — the field that matters most"
                className="w-full rounded-btn border border-dk-attend-border bg-dk-card px-[10px] py-[7px] font-mono text-[12px] text-dk-ink"
              />
              <span className="text-ink-secondary">reason</span>
              <input
                data-testid="seed-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="one sentence — how the document reads"
                className="w-full rounded-btn border border-dk-line-2 bg-dk-card px-[10px] py-[7px] font-mono text-[12px] text-dk-ink"
              />
              <span className="text-ink-secondary">signed by</span>
              <input
                data-testid="seed-signed"
                value={signed}
                onChange={(e) => setSigned(e.target.value)}
                placeholder="your name — the log carries it forever"
                className="max-w-[220px] rounded-btn border border-dk-line-2 bg-dk-card px-[10px] py-[7px] font-mono text-[12px] text-dk-ink"
              />
            </div>
            <div className="mt-[10px] flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="seed-correct-btn"
                disabled={!canCorrect || correct.isPending}
                onClick={() => correct.mutate()}
                className={`rounded-btn px-4 py-[7px] font-mono text-[12px] font-bold ${
                  canCorrect
                    ? "cursor-pointer border border-attend bg-attend text-ink-invert"
                    : "cursor-not-allowed border border-dashed border-dk-line bg-dk-bg text-ink-secondary"
                }`}
              >
                {canCorrect
                  ? `Correct the record: ${value} · tag → ruled`
                  : "citation, reason and signature required — a correction with no source is an opinion"}
              </button>
            </div>
          </div>
          <div className="mb-2 rounded-[5px] border border-dk-card bg-dk-bg px-[14px] py-3">
            <span className="font-bold text-dash">3 · Demote to suspect</span>{" "}
            <span className="text-ink-dim">
              the document is ambiguous — neither value can be confirmed.{" "}
              <i>No endpoint in the contract yet (CONTRACT GAP) — inert.</i>
            </span>
          </div>
        </>
      )}

      <div className="mt-5 mb-[6px] text-[11px] font-bold tracking-[.08em] text-ink-dim">
        CORRECTION LOG — THIS FIELD ONLY. PERMANENT AND VISIBLE; THE AUDIT
        TRAIL IS THE POINT.
      </div>
      {corrected ? (
        <div
          data-testid="seed-log"
          className="rounded-btn border border-dk-line bg-dk-bg px-[14px] py-[10px] text-[11.5px] leading-[1.6]"
        >
          <span className="font-semibold text-dk-ink-strong">
            {field.corrected_by} — corrected
          </span>
          <br />
          <span className="text-ink-dim">
            {field.corrected_from ?? "—"} → {field.value ?? "—"} · citation:{" "}
            {field.source_citation ?? "—"} · “{field.correction_reason}”
          </span>
        </div>
      ) : (
        <div className="rounded-btn border border-dashed border-dk-line px-[14px] py-3 text-[11.5px] text-ink-secondary">
          empty — first investigation of this field. A field corrected twice is
          a field someone should look at in person before the blind fifty
          covers it.
        </div>
      )}
      <div className="mt-[14px] text-[10.5px] text-ink-secondary">
        ORDER_SUPPLIED fields cannot reach this screen — they are not in the
        bench; there is nothing to correct.
      </div>
    </>
  );
}
