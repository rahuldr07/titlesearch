import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import {
  Ack,
  GoldenAffirmRequest,
  GoldenCorrectionRequest,
  GoldenResponse,
  type GoldenField,
} from "@titlepipe/contract";
import { api } from "../api";
import { useSession } from "../session";
import { MutationNote } from "../components/notice";
import { HomeTitle } from "../components/TopBar";

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
 * All three actions leave a permanent, signed log entry. Confirm-seed affirms
 * the value as-is (tag → ruled, nothing changes); demote-to-suspect flags an
 * ambiguous document (tag → suspect). Both are refused without a reason and a
 * signature — an unsigned change to ground truth is the failure this corpus
 * exists to prevent. One action per field: acting on it retires the others.
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
  // An id WAS supplied but names nothing in the corpus — a stale link is not
  // the same as arriving with no context; say which one happened.
  const stale =
    search.fieldId !== undefined && goldenQ.data !== undefined && field === null;

  return (
    <div className="flex h-screen flex-col bg-document-deep font-mono text-[12px] text-document-ink-soft">
      <div className="flex flex-none flex-wrap items-baseline gap-4 border-b border-document-line px-[14px] py-2">
        <HomeTitle
          title="SEED CORRECTION"
          className="text-[11px] font-bold tracking-[.1em] text-document-ink-soft"
        />
        {field && (
          <span className="text-document-ink-strong">{field.path}</span>
        )}
        <span className="text-document-ink-soft">
          the only place in the system where ground truth changes — one field,
          one document, one record. No bulk operations exist.
        </span>
        <Link
          to="/bench/results"
          className="ml-auto text-[11px] text-page-ref-border no-underline"
        >
          ← bench results
        </Link>
      </div>
      {/* Scan + investigation panes have a fixed minimum width; they scroll
          horizontally within this region so the page body never does. */}
      <div className="flex min-h-0 flex-1 overflow-x-auto">
      <div className="flex min-h-0 min-w-[1080px] flex-1">
        <ScanPane />
        <div className="min-w-[560px] flex-1 overflow-y-auto px-[18px] pt-[14px] pb-10">
          {goldenQ.error != null && (
            <div className="mt-4 text-[12px] text-document-attend">
              Golden corpus unavailable: {String(goldenQ.error)}
            </div>
          )}
          {field ? (
            <Investigation key={field.id} field={field} />
          ) : stale ? (
            <div
              data-testid="stale-link"
              className="mt-8 max-w-[480px] rounded-[6px] border-[1.5px] border-dashed border-document-attend-border px-7 py-8 text-center"
            >
              <div className="mb-3 font-mono text-[20px] text-document-ink-soft">
                — stale link —
              </div>
              <div className="text-[13px] font-semibold text-document-ink">
                This id names a seed field that isn't in the corpus.
              </div>
              <div className="mt-2 text-[12px] leading-[1.6] text-document-ink-soft">
                The link that brought you here (
                <span className="font-mono text-document-attend">
                  {search.fieldId}
                </span>
                ) points at nothing — the field may have been removed or the id
                mistyped. Re-open from a failing cell in{" "}
                <Link to="/bench/results" className="no-underline">
                  bench results
                </Link>
                .
              </div>
            </div>
          ) : (
            !goldenQ.isPending && (
              <div
                data-testid="no-context"
                className="mt-8 max-w-[480px] rounded-[6px] border-[1.5px] border-dashed border-document-line-strong px-7 py-8 text-center"
              >
                <div className="mb-3 font-mono text-[20px] text-document-ink-soft">
                  — no field —
                </div>
                <div className="text-[13px] font-semibold text-document-ink">
                  This screen has no menu entry.
                </div>
                <div className="mt-2 text-[12px] leading-[1.6] text-document-ink-soft">
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
    </div>
  );
}

function ScanPane() {
  const [zoom, setZoom] = useState(100);
  return (
    <div className="flex w-[46%] min-w-[520px] flex-col border-r border-document-line">
      <div className="flex flex-none flex-wrap items-center gap-[10px] border-b border-document-line px-[14px] py-[6px]">
        <span className="font-semibold text-document-ink-strong">seed package scan</span>
        <span className="text-document-ink-soft">
          degraded fax — the typist read a worse copy of this; the document is
          the only authority now
        </span>
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
      <div className="flex flex-1 justify-center overflow-auto p-[18px]">
        <div
          className="relative flex-none self-start rounded-[1px] bg-scan shadow-page"
          style={{
            width: `${Math.round(4.8 * zoom)}px`,
            aspectRatio: "8.5/11",
            filter: "contrast(1.3) brightness(.94)",
          }}
        >
          <div className="absolute top-[22px] left-[36px] h-[11px] w-[48%] bg-document-line-strong" />
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
          <div className="absolute top-[8%] right-[6%] h-[52px] w-[126px] rotate-[-2deg] border-2 border-document-line-strong p-1 text-[8px] text-document-ink-soft">
            RECORDING STAMP
          </div>
          <div className="absolute top-[40%] left-[9%] flex w-[82%] border-2 border-state-halt bg-surface-evidence">
            <span className="px-[5px] py-[3px] text-[10px] leading-[1.4] text-document-ink">
              …principal sum of Two Hundred Twenty Thousand Two Hundred
              Twenty-Four Dollars ($2Z0,224.00)…
            </span>
          </div>
        </div>
      </div>
      <div className="flex-none border-t border-document-line px-[14px] py-[7px] text-[11px] text-document-ink-soft">
        the amount in words is legible where the numerals are not — §5: words
        win over numerals when the two disagree
      </div>
    </div>
  );
}

function Investigation({ field }: { field: GoldenField }) {
  const queryClient = useQueryClient();
  const actor = useSession((s) => s.name);
  const [value, setValue] = useState("");
  const [cite, setCite] = useState("");
  const [reason, setReason] = useState("");

  const candidate = {
    golden_field_id: field.id,
    corrected_value: value.trim() === "" ? null : value.trim(),
    source_citation: cite.trim(),
    reason: reason.trim(),
  };
  // The contract schema is the gate — no source, no reason, no correction. The
  // signer is the authenticated identity (stamped server-side), not typed here.
  const canCorrect = GoldenCorrectionRequest.safeParse(candidate).success;

  const correct = useMutation({
    mutationFn: () =>
      api(Ack, "/api/golden/corrections", {
        method: "POST",
        body: JSON.stringify(candidate),
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["golden"] }),
    onError: () =>
      void queryClient.invalidateQueries({ queryKey: ["golden"] }),
  });

  const corrected = field.corrected_at !== null;
  // The log reflects which of the three actions was taken. A changed value
  // (corrected_from set) is a correction; otherwise the tag says whether the
  // seed was affirmed (ruled) or demoted (suspect).
  const logVerb =
    field.corrected_from !== null
      ? "corrected"
      : field.tag === "suspect"
        ? "demoted to suspect"
        : "confirmed the seed";
  const logDetail =
    field.corrected_from !== null
      ? `${field.corrected_from ?? "—"} → ${field.value ?? "—"}`
      : `value stands: ${field.value ?? "—"} · tag → ${field.tag}`;

  return (
    <>
      <div className="grid grid-cols-[170px_1fr] gap-x-[14px] gap-y-[5px] rounded-sm border border-document-line bg-document-bg px-[14px] py-3">
        <span className="text-document-ink-soft">field</span>
        <span className="font-semibold text-document-ink-strong">{field.path}</span>
        <span className="text-document-ink-soft">current seed value</span>
        <span className="text-document-settled" data-testid="seed-value">
          {field.value ?? "Not Available"}
        </span>
        <span className="text-document-ink-soft">source tag</span>
        <span className="text-document-settled" data-testid="seed-tag">
          {field.tag}
        </span>
        {field.source_citation !== null && (
          <>
            <span className="text-document-ink-soft">citation</span>
            <span>{field.source_citation}</span>
          </>
        )}
      </div>

      {!corrected && (
        <>
          <div className="mt-4 mb-2 text-[11px] font-bold tracking-[.08em] text-document-ink-soft">
            THREE ACTIONS. NOTHING ELSE.
          </div>
          <div className="mb-2 rounded-[5px] border border-document-card bg-document-bg px-[14px] py-3">
            <span className="font-bold text-document-settled">1 · Confirm seed</span>{" "}
            <span className="text-document-ink-soft">
              the seed is correct — the model failure is real. Tag upgrades to{" "}
              <b className="text-document-settled">ruled</b>; the value does not change.
            </span>
            <SeedAffirm field={field} kind="confirm" />
          </div>
          <div className="mb-2 rounded-[5px] border border-document-attend-border bg-document-bg px-[14px] py-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-bold text-document-attend">2 · Correct seed</span>
              <span className="text-document-ink-soft">
                the seed is wrong. Tag upgrades to{" "}
                <b className="text-page-ref-border">ruled</b>. Logged with your
                name. Permanent.
              </span>
            </div>
            <div className="mt-[10px] grid grid-cols-[130px_1fr] items-center gap-x-3 gap-y-2">
              <span className="text-document-ink-soft">correct value</span>
              <input
                data-testid="seed-new-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="max-w-[220px] rounded-sm border border-document-line-strong bg-document-card px-[10px] py-[7px] font-mono text-[12.5px] text-document-ink"
              />
              <span className="text-document-ink-soft">citation</span>
              <input
                data-testid="seed-cite"
                value={cite}
                onChange={(e) => setCite(e.target.value)}
                placeholder="document and page — the field that matters most"
                className="w-full rounded-sm border border-document-attend-border bg-document-card px-[10px] py-[7px] font-mono text-[12px] text-document-ink"
              />
              <span className="text-document-ink-soft">reason</span>
              <input
                data-testid="seed-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="one sentence — how the document reads"
                className="w-full rounded-sm border border-document-line-strong bg-document-card px-[10px] py-[7px] font-mono text-[12px] text-document-ink"
              />
              <span className="text-document-ink-soft">signed as</span>
              <span data-testid="seed-signed-as" className="text-document-ink">
                {actor}{" "}
                <span className="text-document-ink-soft">
                  — from your session; the log carries it forever
                </span>
              </span>
            </div>
            <div className="mt-[10px] flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="seed-correct-btn"
                disabled={!canCorrect || correct.isPending}
                onClick={() => correct.mutate()}
                className={`rounded-sm px-4 py-[7px] font-mono text-[12px] font-bold ${
                  canCorrect
                    ? "cursor-pointer border border-state-attend bg-state-attend text-ink-on-action"
                    : "cursor-not-allowed border border-dashed border-document-line bg-document-bg text-document-ink-soft"
                }`}
              >
                {canCorrect
                  ? `Correct the record: ${value} · tag → ruled`
                  : "citation and reason required — a correction with no source is an opinion"}
              </button>
            </div>
            {correct.error != null && (
              <MutationNote
                register="dark"
                testid="seed-correct-note"
                error={correct.error}
              />
            )}
          </div>
          <div className="mb-2 rounded-[5px] border border-document-card bg-document-bg px-[14px] py-3">
            <span className="font-bold text-document-line-strong">3 · Demote to suspect</span>{" "}
            <span className="text-document-ink-soft">
              the document is ambiguous — neither value can be confirmed. Tag →{" "}
              <b className="text-document-line-strong">suspect</b>; the value does not change.
            </span>
            <SeedAffirm field={field} kind="demote" />
          </div>
        </>
      )}

      <div className="mt-5 mb-[6px] text-[11px] font-bold tracking-[.08em] text-document-ink-soft">
        CORRECTION LOG — THIS FIELD ONLY. PERMANENT AND VISIBLE; THE AUDIT
        TRAIL IS THE POINT.
      </div>
      {corrected ? (
        <div
          data-testid="seed-log"
          className="rounded-sm border border-document-line bg-document-bg px-[14px] py-[10px] text-[11.5px] leading-[1.6]"
        >
          <span className="font-semibold text-document-ink-strong">
            {field.corrected_by} — {logVerb}
          </span>
          <br />
          <span className="text-document-ink-soft">
            {logDetail} · citation: {field.source_citation ?? "—"} · “
            {field.correction_reason}”
          </span>
        </div>
      ) : (
        <div className="rounded-sm border border-dashed border-document-line px-[14px] py-3 text-[11.5px] text-document-ink-soft">
          empty — first investigation of this field. A field corrected twice is
          a field someone should look at in person before the blind fifty
          covers it.
        </div>
      )}
      <div className="mt-[14px] text-[10.5px] text-document-ink-soft">
        ORDER_SUPPLIED fields cannot reach this screen — they are not in the
        bench; there is nothing to correct.
      </div>
    </>
  );
}

/**
 * Confirm-seed and demote-to-suspect: the value never changes, but the action
 * is permanent and signed. The contract schema is the gate — no reason, no
 * action. The signer is the authenticated session identity, stamped
 * server-side, not typed here.
 */
function SeedAffirm({
  field,
  kind,
}: {
  field: GoldenField;
  kind: "confirm" | "demote";
}) {
  const queryClient = useQueryClient();
  const actor = useSession((s) => s.name);
  const [reason, setReason] = useState("");

  const candidate = { reason: reason.trim() };
  const valid = GoldenAffirmRequest.safeParse(candidate).success;

  const affirm = useMutation({
    mutationFn: () =>
      api(Ack, `/api/golden/${field.id}/${kind}`, {
        method: "POST",
        body: JSON.stringify(candidate),
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["golden"] }),
    onError: () =>
      void queryClient.invalidateQueries({ queryKey: ["golden"] }),
  });

  const label = kind === "confirm" ? "Confirm — value stands, tag → ruled" : "Demote — value stands, tag → suspect";
  const held =
    kind === "confirm"
      ? "reason required — even affirming ground truth is on the record"
      : "reason required — a demotion is a diagnosis, on the record";

  return (
    <div className="mt-[10px] grid grid-cols-[130px_1fr] items-center gap-x-3 gap-y-2">
      <span className="text-document-ink-soft">reason</span>
      <input
        data-testid={`seed-${kind}-reason`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={
          kind === "confirm"
            ? "one sentence — how the document confirms the seed"
            : "one sentence — why neither value can be confirmed"
        }
        className="w-full rounded-sm border border-document-line-strong bg-document-card px-[10px] py-[7px] font-mono text-[12px] text-document-ink"
      />
      <span className="text-document-ink-soft">signed as</span>
      <span data-testid={`seed-${kind}-signed-as`} className="text-document-ink">
        {actor}{" "}
        <span className="text-document-ink-soft">— from your session</span>
      </span>
      <div className="col-span-2 mt-[2px]">
        <button
          type="button"
          data-testid={`seed-${kind}-btn`}
          disabled={!valid || affirm.isPending}
          onClick={() => affirm.mutate()}
          className={`rounded-sm px-4 py-[7px] font-mono text-[12px] font-bold ${
            valid
              ? kind === "confirm"
                ? "cursor-pointer border border-document-settled bg-document-settled text-ink-on-action"
                : "cursor-pointer border border-document-line-strong bg-document-line-strong text-ink-on-action"
              : "cursor-not-allowed border border-dashed border-document-line bg-document-bg text-document-ink-soft"
          }`}
        >
          {valid ? label : held}
        </button>
        {affirm.error != null && (
          <MutationNote
            register="dark"
            testid={`seed-${kind}-note`}
            error={affirm.error}
          />
        )}
      </div>
    </div>
  );
}
