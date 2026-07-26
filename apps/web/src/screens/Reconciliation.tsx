import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  Ack,
  ReconciliationResponse,
  ReconciliationRulingRequest,
  type Reconciliation,
} from "@titlepipe/contract";
import { api } from "../api";
import { MutationNote } from "../components/notice";
import { HomeTitle } from "../components/TopBar";

/**
 * Reconciliation (frontend-master-prompt §4.13), to the Reconciliation
 * .dc.html pixel spec: SYMMETRIC A/B layout — the model is not a party to
 * this conversation; its output appears nowhere. Every ruling requires a
 * CITATION (a ruling with no source is an opinion) and submits per-path. A
 * general rule may be OFFERED by the senior — never pre-selected, and the
 * draft textarea starts EMPTY (§0.4 bans pre-populated suggestions); drafts
 * land PENDING.
 *
 * CONTRACT GAP: per-side typist citations/confidence (Reconciliation carries
 * value_a/value_b only), so the A/B cards show values symmetric and bare.
 */
export function ReconciliationScreen() {
  const { orderId } = useParams({ from: "/reconciliation/$orderId" });
  const reconQ = useQuery({
    queryKey: ["reconciliation", orderId],
    queryFn: () =>
      api(ReconciliationResponse, `/api/reconciliation/${orderId}`),
  });
  const divergences = reconQ.data?.divergences ?? [];
  const open = divergences.filter((d) => d.ruled_by === null);
  const ruled = divergences.filter((d) => d.ruled_by !== null);

  return (
    <div className="flex h-screen flex-col bg-surface-app font-sans text-ink-primary">
      <div className="flex flex-none flex-wrap items-baseline justify-between gap-x-[14px] gap-y-2 border-b border-line-strong bg-surface-panel px-[18px] py-[10px]">
        <div className="flex flex-wrap items-baseline gap-[14px]">
          <HomeTitle
            title="RECONCILIATION"
            className="text-[12px] font-bold tracking-[.12em] text-ink-secondary"
          />
          <div className="text-[13px] font-semibold">
            <span className="font-mono">{orderId}</span> ·{" "}
            {divergences.length} divergences
          </div>
          <div className="text-[12.5px] font-bold text-page-ref tabular-nums">
            {ruled.length} of {divergences.length} ruled
          </div>
          <div className="text-[12px] text-ink-secondary">
            every ruling here is permanent ground truth — you are not clearing
            a backlog, you are writing law
          </div>
        </div>
        <span className="rounded-xs border border-dashed border-line-dashed bg-surface-raised px-2 py-[2px] text-[10px] font-bold tracking-[.06em] text-ink-secondary">
          the model is not a party to this conversation — its output appears
          nowhere
        </span>
      </div>
      {reconQ.isPending ? (
        <div className="flex flex-1 items-center justify-center p-[30px] text-[13px] text-ink-secondary">
          Loading divergences…
        </div>
      ) : reconQ.error != null ? (
        <div className="flex flex-1 items-center justify-center p-[30px] text-[13px] text-state-halt">
          Reconciliation unavailable: {String(reconQ.error)}
        </div>
      ) : divergences.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-[30px]">
          <div
            data-testid="recon-empty"
            className="max-w-[460px] rounded-md border border-line-strong bg-surface-panel px-8 py-[30px]"
          >
            <div className="text-[15px] font-semibold">
              No divergences recorded for this order.
            </div>
            <div className="mt-2 text-[13px] leading-[1.6] text-ink-secondary">
              Either the blind pair hasn't been captured yet, or this order id
              isn't part of the blind fifty. Nothing to rule on here.
            </div>
          </div>
        </div>
      ) : open.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-[30px]">
          <div
            data-testid="recon-done"
            className="max-w-[460px] rounded-md border border-line-strong bg-surface-panel px-8 py-[30px]"
          >
            <div className="text-[15px] font-semibold">Order reconciled.</div>
            <div className="mt-2 text-[13px] leading-[1.6] text-ink-secondary">
              Every ruled field entered the golden set as <b>ruled</b> —
              permanent. Drafted general rules sit PENDING in the rulebook
              until an engineer confirms them.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-x-auto">
          {/* The symmetric two-pane layout has a fixed minimum width; it
              scrolls horizontally WITHIN this region so the page body never
              does — the header above stays put on a narrow laptop. */}
          <div className="flex min-h-0 min-w-[1280px] flex-1">
          <div className="flex w-[44%] min-w-[500px] flex-col bg-document-bg">
            <div className="flex flex-none flex-wrap items-center gap-[6px] border-b border-document-line px-[18px] py-[10px]">
              <span className="text-[10.5px] tracking-[.05em] text-document-ink-soft">
                SOURCE — read the page, then rule
              </span>
            </div>
            <div className="flex flex-1 justify-center overflow-y-auto px-5 py-6">
              <div className="relative aspect-[8.5/11] w-[min(560px,100%)] flex-none self-start rounded-[2px] bg-page shadow-page">
                <div className="absolute top-7 left-[46px] h-[14px] w-[46%] rounded-[2px] bg-page-bar" />
                <div
                  className="absolute top-14 right-[46px] bottom-[42px] left-[46px]"
                  style={{
                    background:
                      "repeating-linear-gradient(to bottom, var(--color-page-line) 0 9px, transparent 9px 23px)",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="min-w-[560px] flex-1 overflow-y-auto border-l border-line-strong bg-surface-panel px-[22px] pt-4 pb-10">
            {ruled.map((d) => (
              <div
                key={d.id}
                data-testid={`ruled-${d.path}`}
                className="mb-[7px] flex flex-wrap items-baseline gap-[10px] rounded-sm border border-line-subtle bg-surface-raised px-3 py-2 text-[12px]"
              >
                <span className="font-bold text-state-settled">✓ ruled</span>
                <span className="font-mono">{d.path}</span>
                <span className="text-ink-secondary">
                  {d.ruling_value ?? "Not Available"} · {d.citation}
                </span>
                {d.general_rule_id !== null && (
                  <span className="rounded-xs border border-state-attend-border bg-state-attend-surface px-[7px] py-px text-[10px] font-bold text-state-attend">
                    RULEBOOK DRAFT — PENDING
                  </span>
                )}
              </div>
            ))}
            <div className="mt-4 mb-1 flex flex-wrap items-baseline gap-3">
              <div className="text-[12px] font-bold tracking-[.08em] text-ink-primary">
                {open.length} DIVERGENCES OPEN
              </div>
              <span className="rounded-[3px] border border-dashed border-state-attend-border bg-state-attend-surface px-2 py-px text-[11px] text-state-attend">
                Lowest typist accuracy section. Rule with source or not at all.
              </span>
            </div>
            <div className="mb-[10px] text-[11px] text-ink-muted">
              certain-vs-certain first — the cleanest cases inform the harder
              ones · R13–R24 landed 07/2026 — cite the rule where one exists;
              memory is not a citation
            </div>
            {open.map((d) => (
              <DivergenceCard key={d.id} divergence={d} orderId={orderId} />
            ))}
            <div className="mt-3 text-[11px] text-ink-muted">
              the next order opens only when all are ruled — there are no
              partial reconciliations
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

function DivergenceCard({
  divergence: d,
  orderId,
}: {
  divergence: Reconciliation;
  orderId: string;
}) {
  const queryClient = useQueryClient();
  const [winner, setWinner] = useState<"A" | "B" | "third" | null>(null);
  const [thirdVal, setThirdVal] = useState("");
  const [thirdWhy, setThirdWhy] = useState("");
  const [cite, setCite] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftText, setDraftText] = useState("");

  const rulingValue =
    winner === "A"
      ? d.value_a
      : winner === "B"
        ? d.value_b
        : winner === "third"
          ? thirdVal.trim() || null
          : null;

  const buildRequest = (withDraft: boolean) => ({
    path: d.path,
    ruling_value: rulingValue,
    citation: cite.trim(),
    ...(winner === "third" && thirdWhy.trim() !== ""
      ? { reason: thirdWhy.trim() }
      : {}),
    ...(withDraft
      ? { general_rule_draft: { text: draftText.trim() } }
      : {}),
  });

  // Contract gate: no citation, no ruling. Third value additionally needs its why.
  const baseValid =
    winner !== null &&
    ReconciliationRulingRequest.safeParse(buildRequest(false)).success &&
    (winner !== "third" || (thirdVal.trim() !== "" && thirdWhy.trim() !== ""));

  const rule = useMutation({
    mutationFn: (withDraft: boolean) =>
      api(Ack, `/api/reconciliation/${orderId}`, {
        method: "POST",
        body: JSON.stringify(buildRequest(withDraft)),
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["reconciliation", orderId],
      }),
    // An already-ruled 409 refetches too: the row moving to the ruled list
    // is itself the explanation.
    onError: () =>
      void queryClient.invalidateQueries({
        queryKey: ["reconciliation", orderId],
      }),
  });

  const sideCard = (side: "A" | "B", value: string | null) => (
    <button
      type="button"
      data-testid={`pick-${side}-${d.path}`}
      onClick={() => setWinner(side)}
      className={`cursor-pointer rounded-[5px] border px-3 py-[10px] text-left font-sans ${
        winner === side
          ? "border-page-ref bg-page-ref-surface shadow-[inset_0_0_0_1px_var(--color-page-ref)]"
          : "border-line-strong bg-surface-panel"
      }`}
    >
      <div className="text-[10px] font-bold tracking-[.08em] text-ink-secondary">
        TYPIST {side}
      </div>
      <div className="mt-1 font-mono text-[13px]">
        {value ?? "Not Available"}
      </div>
    </button>
  );

  return (
    <div
      data-testid={`div-${d.path}`}
      className="mb-[10px] rounded-md border border-line-strong bg-surface-panel px-4 py-[13px] shadow-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-[10px]">
        <span className="font-mono text-[13px] font-semibold">{d.path}</span>
        <span className="text-[10.5px] text-ink-secondary">
          symmetric — neither side leads
        </span>
      </div>
      <div className="mt-[10px] grid grid-cols-2 gap-[10px]">
        {sideCard("A", d.value_a)}
        {sideCard("B", d.value_b)}
      </div>
      <button
        type="button"
        onClick={() => setWinner("third")}
        className={`mt-2 cursor-pointer rounded-sm border px-3 py-[6px] text-left font-sans text-[12px] ${
          winner === "third"
            ? "border-page-ref bg-page-ref-surface font-semibold text-page-ref"
            : "border-line-strong bg-transparent text-ink-secondary"
        }`}
      >
        both are wrong — enter a third value
      </button>
      {winner === "third" && (
        <>
          <input
            data-testid={`third-val-${d.path}`}
            value={thirdVal}
            onChange={(e) => setThirdVal(e.target.value)}
            placeholder="the correct value"
            className="mt-2 w-full rounded-sm border border-line-strong bg-surface-panel px-[10px] py-[7px] font-mono text-[12.5px]"
          />
          <input
            data-testid={`third-why-${d.path}`}
            value={thirdWhy}
            onChange={(e) => setThirdWhy(e.target.value)}
            placeholder="why both typists were wrong — one sentence minimum, stored with the ruling"
            className="mt-[6px] w-full rounded-sm border border-line-strong bg-surface-panel px-[10px] py-[7px] font-sans text-[12.5px]"
          />
        </>
      )}
      {winner !== null && (
        <>
          <input
            data-testid={`cite-${d.path}`}
            value={cite}
            onChange={(e) => setCite(e.target.value)}
            placeholder="your source citation — a ruling with no source is an opinion"
            className="mt-2 w-full rounded-sm border border-state-attend-border bg-surface-panel px-[10px] py-[7px] font-sans text-[12.5px]"
          />
          {!drafting ? (
            <div className="mt-[10px] border-t border-line-subtle pt-[10px]">
              <div className="mb-2 text-[11px] text-ink-secondary">
                Is this a one-off, or did you just see a pattern? Neither is
                pre-selected.
              </div>
              <div className="flex flex-wrap gap-[10px]">
                <button
                  type="button"
                  data-testid={`rule-field-${d.path}`}
                  disabled={!baseValid || rule.isPending}
                  onClick={() => rule.mutate(false)}
                  className={`rounded-sm border px-[14px] py-[7px] font-sans text-[12px] font-semibold ${
                    baseValid
                      ? "cursor-pointer border-line-strong bg-surface-panel text-ink-primary"
                      : "cursor-not-allowed border-dashed border-line-dashed bg-track text-ink-secondary"
                  }`}
                >
                  Field ruling — this order only
                </button>
                <button
                  type="button"
                  data-testid={`rule-general-${d.path}`}
                  disabled={!baseValid}
                  onClick={() => setDrafting(true)}
                  className={`rounded-sm border px-[14px] py-[7px] font-sans text-[12px] font-semibold ${
                    baseValid
                      ? "cursor-pointer border-page-ref-border bg-surface-panel text-page-ref"
                      : "cursor-not-allowed border-dashed border-line-dashed bg-track text-ink-secondary"
                  }`}
                >
                  General rule — draft for the rulebook
                </button>
                <span className="self-center text-[10.5px] text-ink-muted">
                  enters the golden set as <b>ruled</b> — permanent
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-[10px] border-t border-line-subtle pt-[10px]">
              <div className="mb-[5px] text-[10.5px] font-bold tracking-[.06em] text-page-ref">
                DRAFT RULE — YOUR WORDS, NOTHING PRE-WRITTEN · FILES AS
                PENDING, NOT LIVE UNTIL AN ENGINEER CONFIRMS
              </div>
              <textarea
                data-testid={`draft-${d.path}`}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                className="min-h-[56px] w-full resize-y rounded-[5px] border-[1.5px] border-line-dashed bg-surface-panel px-[11px] py-2 font-sans text-[13px] leading-[1.5]"
              />
              <button
                type="button"
                data-testid={`file-draft-${d.path}`}
                disabled={
                  !baseValid || draftText.trim() === "" || rule.isPending
                }
                onClick={() => rule.mutate(true)}
                className={`mt-2 rounded-sm border px-4 py-[7px] font-sans text-[12px] font-semibold ${
                  baseValid && draftText.trim() !== ""
                    ? "cursor-pointer border-page-ref bg-page-ref text-ink-on-action"
                    : "cursor-not-allowed border-dashed border-line-dashed bg-track text-ink-secondary"
                }`}
              >
                File ruling + draft as PENDING
              </button>
            </div>
          )}
          {rule.error != null && (
            <MutationNote testid="rule-note" error={rule.error} />
          )}
        </>
      )}
    </div>
  );
}
