import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import {
  Ack,
  OrderFieldsResponse,
  PassOrderResponse,
  canDo,
  type Field,
  type FieldReading,
} from "@titlepipe/contract";
import { api } from "../api";
import { MutationNote } from "../components/notice";
import { OrderRail } from "../components/OrderRail";
import { parseLineCoords, type PdfHighlight } from "../components/coords";

// Lazy: react-pdf/pdfjs (~400 kB) loads only when the pane mounts — the
// coords/type imports above come from the light module so this split holds.
const PdfPane = lazy(() =>
  import("../components/PdfPane").then((m) => ({ default: m.PdfPane })),
);
import {
  ReadingCard,
  displayDraft,
  fieldChips,
  fieldLabel,
  provenanceMissing,
  readingsDisagree,
  sectionOf,
  statePill,
} from "../components/field";
import { HomeTitle } from "../components/TopBar";
import { useSession } from "../session";
import { useReviewUi } from "../stores/review";

/**
 * Review — THE FLAGSHIP (frontend-master-prompt §4.2), to the Review
 * Screen.dc.html pixel spec. Field-by-field: dual A/B readings, PdfPane
 * click-to-source, confirm / correct / escalate / file-bug / pass, one key
 * per action. AB-disagreement and PRESENT_UNREADABLE lead the hierarchy.
 *
 * Deliberate deviations from the .dc.html, per the §0 laws + contract:
 * - No Approve button: the contract has no approve endpoint (CONTRACT GAP).
 *   Completion = every queued field resolved; the reviewer moves on.
 * - No derived/ƒ-COMPUTED fields or derivation panel: FieldState carries no
 *   derived state and no derivation payload exists (CONTRACT GAP).
 * - No "THRESHOLD .85" marker on the confidence bar: the server owns
 *   thresholds; the UI does not know one to draw.
 * - Correct-in-place requires a REASON (§0.5) — the .dc.html collected only
 *   the value; the refusal law wins over the pixels.
 */
export function ReviewScreen() {
  const { orderId } = useParams({ from: "/orders/$orderId/review" });
  const search = useSearch({ from: "/orders/$orderId/review" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const ui = useReviewUi();
  const role = useSession((s) => s.role);
  const [scrollNonce, setScrollNonce] = useState(0);
  // "correct to this" seeds the editor with a clicked reading — retyping a
  // value that is already on screen is the transcription-error class this
  // product exists to kill. Cleared whenever the selection moves.
  const [seedOverride, setSeedOverride] = useState<string | null>(null);
  // A refused Enter must SAY so — silence reads as a broken keyboard.
  const [nudge, setNudge] = useState<"escalate" | "bug" | "pass" | null>(null);

  const fieldsQ = useQuery({
    queryKey: ["orders", orderId, "fields"],
    queryFn: () => api(OrderFieldsResponse, `/api/orders/${orderId}/fields`),
  });

  const fields = useMemo(() => fieldsQ.data?.fields ?? [], [fieldsQ.data]);
  const queueIds = useMemo(
    () => fields.filter((f) => f.state === "needs_review").map((f) => f.id),
    [fields],
  );
  const selected = fields.find((f) => f.id === ui.selectedId) ?? null;

  useEffect(() => {
    if (fields.length === 0) return;
    if (ui.selectedId !== null && fields.some((f) => f.id === ui.selectedId))
      return;
    // a ?field= deep link arrives already knowing which field it means
    const linked =
      search.field !== undefined
        ? fields.find((f) => f.path === search.field)?.id
        : undefined;
    const first = linked ?? queueIds[0] ?? fields[0]?.id;
    if (first !== undefined) ui.select(first);
  }, [fields, queueIds, ui, search.field]);

  useEffect(() => () => useReviewUi.getState().reset(), [orderId]);
  useEffect(() => setSeedOverride(null), [ui.selectedId]);
  useEffect(() => setNudge(null), [ui.mode, ui.selectedId]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["orders", orderId, "fields"] });

  /** Next unresolved queued field after `fromId`, from the pre-mutation queue. */
  const advance = (fromId: string) => {
    const i = queueIds.indexOf(fromId);
    const next =
      i >= 0
        ? [...queueIds.slice(i + 1), ...queueIds.slice(0, i)][0]
        : queueIds[0];
    if (next !== undefined) ui.select(next);
  };

  const confirm = useMutation({
    mutationFn: (f: Field) =>
      api(Ack, `/api/fields/${f.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ value: f.value }),
      }),
    onSuccess: (_r, f) => {
      void invalidate();
      advance(f.id);
    },
    // A 409 (bug-5: different value, or terminal state) is an answer, not a
    // no-op: the refetch repaints the field as the server has it, the note
    // below the pill says why, and selection does NOT advance.
    onError: () => void invalidate(),
  });

  const correct = useMutation({
    mutationFn: (v: { field: Field; value: string; reason: string }) =>
      api(Ack, `/api/fields/${v.field.id}/correct`, {
        method: "POST",
        body: JSON.stringify({ value: v.value, reason: v.reason }),
      }),
    onSuccess: (_r, v) => {
      ui.setMode("idle");
      void invalidate();
      advance(v.field.id);
    },
    onError: () => void invalidate(),
  });

  const escalate = useMutation({
    mutationFn: (v: { field: Field; question: string }) =>
      api(Ack, `/api/fields/${v.field.id}/escalate`, {
        method: "POST",
        body: JSON.stringify({ question: v.question }),
      }),
    onSuccess: (_r, v) => {
      ui.setMode("idle");
      void invalidate();
      advance(v.field.id);
    },
    onError: () => void invalidate(),
  });

  const fileBug = useMutation({
    mutationFn: (v: { field: Field | null; description: string }) =>
      api(Ack, "/api/bugs", {
        method: "POST",
        body: JSON.stringify({
          order_id: orderId,
          field_id: v.field?.id ?? null,
          description: v.description,
        }),
      }),
    onSuccess: () => ui.setMode("idle"),
  });

  const pass = useMutation({
    mutationFn: (reason: string) =>
      api(PassOrderResponse, `/api/orders/${orderId}/pass`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => void navigate({ to: "/queue" }),
  });

  // Ops/engineer arrive here via deep links to SEE a field in context —
  // acting on it belongs to review roles (authz table: field.*). The fine
  // per-field state test below stays server-derived, as ever.
  const mayReview = canDo(role, "field.confirm");
  const canAct =
    mayReview &&
    selected !== null &&
    (selected.state === "needs_review" ||
      ((selected.state === "confirmed" || selected.state === "auto_confirmed") &&
        selected.approved_by === null &&
        selected.na_reason === null));
  const idle = ui.mode === "idle";

  const step = (dir: 1 | -1) => {
    if (queueIds.length === 0) return;
    const i = ui.selectedId !== null ? queueIds.indexOf(ui.selectedId) : -1;
    const next =
      queueIds[i < 0 ? 0 : (i + dir + queueIds.length) % queueIds.length];
    if (next !== undefined) ui.select(next);
  };

  const hk = { preventDefault: true } as const;
  useHotkeys("j,down", () => step(1), { ...hk, enabled: idle }, [queueIds, ui.selectedId]);
  useHotkeys("k,up", () => step(-1), { ...hk, enabled: idle }, [queueIds, ui.selectedId]);
  useHotkeys(
    "enter",
    () => {
      // ⏎ confirms only when there is a VALUE to confirm. On a missing/
      // disagreement field the same key would mean "accept nothing" — a
      // habituated confirm rhythm must never ship a blank; accepting N/A
      // takes an explicit click.
      if (selected && canAct && selected.value !== null) confirm.mutate(selected);
    },
    { ...hk, enabled: idle },
    [selected, canAct],
  );
  useHotkeys(
    "c",
    () => {
      if (canAct) ui.setMode("editing");
    },
    { ...hk, enabled: idle },
    [canAct],
  );
  useHotkeys(
    "e",
    () => {
      if (canAct) ui.setMode("escalating");
    },
    { ...hk, enabled: idle },
    [canAct],
  );
  useHotkeys(
    "b",
    () => {
      if (canDo(role, "bug.file")) ui.setMode("bug");
    },
    { ...hk, enabled: idle },
    [role],
  );
  useHotkeys(
    "p",
    () => {
      if (canDo(role, "order.pass")) ui.setMode("passing");
    },
    { ...hk, enabled: idle },
    [role],
  );
  useHotkeys(
    "s",
    () => setScrollNonce((n) => n + 1),
    { ...hk, enabled: idle },
    [],
  );

  const sections = useMemo(() => {
    const order: string[] = [];
    const byTitle = new Map<string, Field[]>();
    for (const f of fields) {
      const title = sectionOf(f.path);
      if (!byTitle.has(title)) {
        byTitle.set(title, []);
        order.push(title);
      }
      byTitle.get(title)?.push(f);
    }
    return order.map((title) => ({ title, fields: byTitle.get(title) ?? [] }));
  }, [fields]);

  if (fieldsQ.isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg font-sans text-[13px] text-ink-dim">
        Loading fields…
      </div>
    );
  }
  if (fieldsQ.error != null) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg font-sans text-[13px] text-act">
        {String(fieldsQ.error)}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-bg font-sans text-ink">
      {/* header */}
      <div className="flex flex-none items-center justify-between border-b border-line bg-surface px-[18px] py-[10px]">
        <div className="flex items-baseline gap-[14px]">
          <HomeTitle
            title="TITLE REPORT REVIEW"
            className="text-[12px] font-bold tracking-[.12em] text-label"
          />
          <div className="text-[13px] font-semibold">
            Order <span className="font-mono">{orderId}</span>
          </div>
        </div>
        <div className="flex items-center gap-[14px]">
          <Link
            to="/escalations"
            className="text-[12px] font-semibold no-underline"
          >
            Escalation inbox →
          </Link>
          <div className="text-[12.5px] text-ink-secondary tabular-nums">
            {fields.length} fields drafted · {queueIds.length} remaining
          </div>
          {queueIds.length === 0 ? (
            <Link
              to="/queue"
              className="rounded-btn border border-ok bg-ok px-[18px] py-2 text-[13px] font-semibold text-ink-invert no-underline"
            >
              All resolved — next order
            </Link>
          ) : !canDo(role, "order.pass") ? null : (
            <div className="relative">
              <button
                type="button"
                onClick={() => ui.setMode(ui.mode === "passing" ? "idle" : "passing")}
                className="cursor-pointer rounded-btn border border-line-strong bg-transparent px-[14px] py-[6px] font-sans text-[12.5px] font-semibold text-ink-secondary"
              >
                Pass — say why
                <span className="ml-2 rounded-chip bg-line-light px-[5px] font-mono text-[10.5px]">
                  P
                </span>
              </button>
              {ui.mode === "passing" && (
                <div className="absolute top-[calc(100%+6px)] right-0 z-40 w-[320px] rounded-[5px] border border-line-strong bg-card p-3 shadow-pop">
                  <input
                    autoFocus
                    placeholder="One line — why are you passing?"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const reason = e.currentTarget.value.trim();
                        if (reason) pass.mutate(reason);
                        else setNudge("pass");
                      } else if (e.key === "Escape") ui.setMode("idle");
                    }}
                    className="w-full rounded-btn border border-dash bg-input px-[10px] py-2 font-sans text-[13px]"
                  />
                  {nudge === "pass" ? (
                    <div
                      data-testid="nudge"
                      className="mt-[5px] text-[11px] font-semibold text-attend"
                    >
                      held — a pass needs its why, one line.
                    </div>
                  ) : (
                    <div className="mt-[5px] text-[11px] text-ink-dim">
                      ⏎ pass · esc keep it · recorded against the order — 4
                      passes auto-raises an escalation
                    </div>
                  )}
                  {pass.error != null && (
                    <MutationNote testid="pass-note" error={pass.error} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <OrderRail orderId={orderId} fields={fields} />

      {/* main split */}
      <div className="flex min-h-0 flex-1">
        {/* report pane */}
        <div className="w-[45%] min-w-[520px] overflow-y-auto border-r border-line-strong bg-input px-[22px] pt-[18px] pb-10">
          <div className="mb-[14px] flex flex-wrap items-center gap-[14px] border-b border-line-light pb-[14px]">
            <div className="text-[11px] font-bold tracking-[.1em] text-label">
              ASSEMBLED REPORT — AS THE CLIENT WILL SEE IT
            </div>
            <div className="ml-auto flex gap-3 text-[10.5px] text-ink-secondary">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-[2px] border-[1.5px] border-dash bg-input" />
                confirmed
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-[2px] border-[1.5px] border-attend-border bg-attend-bg" />
                needs review
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-[2px] bg-act" />
                missing
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-[2px] bg-line-light" />
                N/A expected
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-[2px] border-[1.5px] border-dotted border-neutral-border bg-input" />
                pending
              </span>
            </div>
          </div>
          {sections.map((sec) => (
            <div key={sec.title} className="mb-5">
              <div className="mb-1 flex items-baseline justify-between rounded-[3px] bg-track px-[10px] py-1">
                <span className="text-[11px] font-bold tracking-[.1em] text-ink-body">
                  {sec.title}
                </span>
                <span className="text-[10.5px] tracking-[.04em] text-ink-dim">
                  {pageRangeOf(sec.fields)}
                </span>
              </div>
              {sec.fields.map((f) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  isSelected={f.id === ui.selectedId}
                  editing={ui.mode === "editing" && f.id === ui.selectedId}
                  onSelect={() => ui.select(f.id)}
                  onCommit={(value, reason) =>
                    correct.mutate({ field: f, value, reason })
                  }
                  onCancel={() => ui.setMode("idle")}
                  commitError={
                    correct.variables?.field.id === f.id ? correct.error : null
                  }
                  seedOverride={f.id === ui.selectedId ? seedOverride : null}
                />
              ))}
            </div>
          ))}
        </div>

        {/* source pane */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-dk-bg">
          {selected && (
            <SourcePane
              field={selected}
              pinnedReadingId={ui.pinnedReadingId}
              scrollNonce={scrollNonce}
            />
          )}

          {/* detail panel */}
          {selected && (
            <div className="max-h-[62%] flex-none overflow-y-auto border-t border-dk-line-2 bg-dk-panel px-[18px] pt-[14px] pb-4 text-dk-ink">
              <div className="mb-[6px] flex items-baseline justify-between">
                <div className="flex items-baseline gap-[10px]">
                  <span className="text-[11px] font-bold tracking-[.08em] text-ink-dim">
                    {sectionOf(selected.path)}
                  </span>
                  <span className="text-[13px] font-semibold" data-testid="sel-label">
                    {fieldLabel(selected.path)}
                  </span>
                </div>
                <span className="text-[11.5px] text-dash tabular-nums">
                  {queueIds.includes(selected.id)
                    ? `${queueIds.indexOf(selected.id) + 1} of ${queueIds.length} still queued`
                    : "Not in queue"}
                </span>
              </div>
              <div className="mb-2 flex flex-wrap items-baseline gap-3">
                {/* When readings carry candidates, the headline shows the
                    draft AS a draft — "Not Available" above two visible
                    values is a contradiction, not caution. */}
                <span
                  className={`font-mono text-[19px] font-semibold ${
                    selected.value === null && selected.state === "needs_review"
                      ? displayDraft(selected) !== null
                        ? "text-dk-attend"
                        : "text-dk-act"
                      : selected.na_reason === "NOT_PRESENT"
                        ? "text-ink-dim"
                        : "text-dk-ink-strong"
                  }`}
                >
                  {selected.value ??
                    (selected.state === "needs_review"
                      ? displayDraft(selected)
                      : null) ??
                    (selected.state === "pending"
                      ? "not yet extracted"
                      : "Not Available")}
                </span>
                {selected.value === null &&
                  selected.state === "needs_review" &&
                  displayDraft(selected) !== null && (
                    <span className="text-[11px] text-ink-dim">
                      draft — nothing settled yet
                    </span>
                  )}
                <span className={statePill(selected).className} data-testid="sel-state">
                  {statePill(selected).label}
                </span>
              </div>

              {confirm.error != null &&
                confirm.variables?.id === selected.id && (
                  <MutationNote
                    register="dark"
                    testid="confirm-note"
                    error={confirm.error}
                  />
                )}

              <ConfidenceBar field={selected} />

              {selected.rule_refs.length > 0 && (
                <div className="mb-2 font-mono text-[10.5px] text-ink-dim">
                  rules: {selected.rule_refs.join(" · ")}
                </div>
              )}

              {(selected.readings?.length ?? 0) > 0 &&
                selected.state === "needs_review" && (
                  <ReadingsPanel
                    field={selected}
                    pinnedReadingId={ui.pinnedReadingId}
                    onPin={(id) => {
                      ui.pin(ui.pinnedReadingId === id ? null : id);
                      setScrollNonce((n) => n + 1);
                    }}
                    onUse={
                      canAct
                        ? (value) => {
                            setSeedOverride(value);
                            ui.setMode("editing");
                          }
                        : undefined
                    }
                  />
                )}

              <ResolutionNote field={selected} />

              {canAct && ui.mode === "escalating" && (
                <div className="mt-1 flex max-w-[560px] flex-col gap-[5px]">
                  <input
                    autoFocus
                    data-testid="escalate-input"
                    placeholder="One line — what don’t you know? e.g. “same HOA as the one above, why is this one out?”"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const q = e.currentTarget.value.trim();
                        // Refusal §0.5: an escalation without a question never submits.
                        if (q) escalate.mutate({ field: selected, question: q });
                        else setNudge("escalate");
                      } else if (e.key === "Escape") ui.setMode("idle");
                    }}
                    className="w-full rounded-btn border border-dk-attend-border bg-dk-card px-[10px] py-2 font-sans text-[13px] text-dk-ink-strong"
                  />
                  {nudge === "escalate" ? (
                    <div
                      data-testid="nudge"
                      className="text-[11px] font-semibold text-dk-attend"
                    >
                      held — an escalation needs its question. One line: what
                      don't you know?
                    </div>
                  ) : (
                    <div className="text-[11px] text-ink-dim">
                      ⏎ send to the inbox · esc cancel · clears this field from
                      your queue — does not hold the order
                    </div>
                  )}
                  {escalate.error != null &&
                    escalate.variables?.field.id === selected.id && (
                      <MutationNote
                        register="dark"
                        testid="escalate-note"
                        error={escalate.error}
                      />
                    )}
                </div>
              )}

              {ui.mode === "bug" && (
                <div className="mt-1 flex max-w-[560px] flex-col gap-[5px]">
                  <input
                    autoFocus
                    data-testid="bug-input"
                    placeholder="What's wrong? e.g. “the cancellation is attached to the wrong deed”"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const d = e.currentTarget.value.trim();
                        if (d) fileBug.mutate({ field: selected, description: d });
                        else setNudge("bug");
                      } else if (e.key === "Escape") ui.setMode("idle");
                    }}
                    className="w-full rounded-btn border border-dk-act-border bg-dk-card px-[10px] py-2 font-sans text-[13px] text-dk-ink-strong"
                  />
                  {nudge === "bug" ? (
                    <div
                      data-testid="nudge"
                      className="text-[11px] font-semibold text-dk-attend"
                    >
                      held — say what's broken, one line.
                    </div>
                  ) : (
                    <div className="text-[11px] text-ink-dim">
                      ⏎ file to engineering · esc cancel · routes to engineering,
                      not the rules inbox — broken inputs, never corrections
                    </div>
                  )}
                  {fileBug.error != null && (
                    <MutationNote
                      register="dark"
                      testid="bug-note"
                      error={fileBug.error}
                    />
                  )}
                </div>
              )}

              {canAct && idle && (
                <ActionRow
                  field={selected}
                  onConfirm={() => confirm.mutate(selected)}
                  onCorrect={() => ui.setMode("editing")}
                  onEscalate={() => ui.setMode("escalating")}
                />
              )}
              {idle && canDo(role, "bug.file") && (
                <button
                  type="button"
                  onClick={() => ui.setMode("bug")}
                  className="mt-[10px] cursor-pointer rounded-btn border border-dk-act-border bg-transparent px-3 py-[5px] font-sans text-[11.5px] font-semibold text-dk-act"
                >
                  Report pipeline bug
                  <span className="ml-2 rounded-chip bg-dk-act-bg px-[5px] font-mono text-[10.5px]">
                    B
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* shortcut strip */}
      <div className="flex flex-none items-center gap-[18px] border-t border-line bg-surface px-[18px] py-[6px] text-[11.5px] text-ink-secondary">
        <span>
          <Kbd>J</Kbd> / <Kbd>K</Kbd> next / prev queued
        </span>
        <span>
          <Kbd>⏎</Kbd> confirm
        </span>
        <span>
          <Kbd>C</Kbd> correct in place
        </span>
        <span>
          <Kbd>E</Kbd> escalate — one line, no form
        </span>
        <span>
          <Kbd>B</Kbd> pipeline bug
        </span>
        <span>
          <Kbd>S</Kbd> re-centre source
        </span>
        <span>
          <Kbd>P</Kbd> pass order
        </span>
        <span className="ml-auto text-ink-dim">
          a confirmation is evidence too — it is recorded
        </span>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <b className="rounded-chip border border-line-strong bg-line-light px-[5px] font-mono">
      {children}
    </b>
  );
}

/** Page range shown on a section header — a summary of provenance already given. */
function pageRangeOf(fields: Field[]): string {
  const pages = fields
    .flatMap((f) => [
      f.source_page,
      ...(f.readings ?? []).map((r) => r.page),
    ])
    .filter((p): p is number => p !== null);
  if (pages.length === 0) return "";
  const min = Math.min(...pages);
  const max = Math.max(...pages);
  return min === max ? `p ${min}` : `pp ${min}–${max}`;
}

function FieldRow({
  field,
  isSelected,
  editing,
  onSelect,
  onCommit,
  onCancel,
  commitError,
  seedOverride,
}: {
  field: Field;
  isSelected: boolean;
  editing: boolean;
  onSelect: () => void;
  onCommit: (value: string, reason: string) => void;
  onCancel: () => void;
  commitError: unknown;
  seedOverride: string | null;
}) {
  const unresolvedMissing =
    field.state === "needs_review" && field.value === null;
  const bg = isSelected
    ? unresolvedMissing
      ? "bg-sel-missing-bg"
      : "bg-sel-bg"
    : unresolvedMissing
      ? "bg-act-bg"
      : "";
  const refPage =
    field.source_page ??
    (field.readings ?? []).find((r) => r.page !== null)?.page ??
    null;
  const draft = displayDraft(field);
  const chips = fieldChips(field);
  const mark = resolutionMark(field);

  return (
    <div
      id={`fr-${field.id}`}
      data-testid={`row-${field.path}`}
      onClick={onSelect}
      className={`grid cursor-pointer grid-cols-[170px_1fr_46px] items-start gap-[10px] rounded-[3px] px-[10px] py-[5px] ${bg} ${
        isSelected ? "shadow-[inset_0_0_0_2px_var(--color-action)]" : ""
      } hover:bg-row-hover`}
    >
      <div className="pt-[2px] text-[10.5px] font-semibold tracking-[.05em] text-label">
        {fieldLabel(field.path)}
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline gap-2">
        {editing ? (
          <div className="flex w-full flex-col">
            <EditForm
              seed={seedOverride ?? draft ?? ""}
              onCommit={onCommit}
              onCancel={onCancel}
            />
            {commitError != null && (
              <MutationNote testid="correct-note" error={commitError} />
            )}
          </div>
        ) : (
          <>
            <ValueCell field={field} draft={draft} />
            {chips.map((c) => (
              <span key={c.label} className={c.className}>
                {c.label}
              </span>
            ))}
            {mark && (
              <span
                data-testid="row-mark"
                className={`text-[10.5px] font-semibold ${
                  mark.startsWith("↗") ? "text-attend" : "text-ok"
                }`}
              >
                {mark}
              </span>
            )}
          </>
        )}
      </div>
      <div className="pt-[2px] text-right text-[10.5px] text-ink-faint tabular-nums">
        {refPage !== null ? `p ${refPage}` : "—"}
      </div>
    </div>
  );
}

/** Server-recorded resolution marks — rendered from state, never local session flags. */
function resolutionMark(f: Field): string | null {
  if (f.state === "corrected") return "✎ corrected";
  if (f.state === "escalated") return "↗ escalated";
  if (f.state === "confirmed" && f.approved_by !== null) {
    return f.value === null && f.na_reason === null
      ? "✓ accepted N/A"
      : "✓ confirmed";
  }
  return null;
}

function ValueCell({ field, draft }: { field: Field; draft: string | null }) {
  if (field.state === "pending") {
    return (
      <span className="font-sans text-[13px] text-ink-faint italic">
        not yet extracted
      </span>
    );
  }
  if (field.na_reason === "NOT_PRESENT") {
    return <span className="font-mono text-[13px] text-na-ink">Not Available</span>;
  }
  if (field.state === "needs_review") {
    if (draft !== null) {
      return (
        <span className="rounded-t-[2px] border-b-2 border-attend-border bg-attend-bg px-[5px] py-px font-mono text-[13px] text-attend-strong">
          {draft}
        </span>
      );
    }
    return (
      <span className="rounded-[2px] bg-act px-2 py-[2px] font-mono text-[13px] font-semibold text-ink-invert">
        Not Available
      </span>
    );
  }
  if (field.value === null) {
    return (
      <span className="font-mono text-[13px] text-ink-secondary">
        Not Available
      </span>
    );
  }
  return <span className="font-mono text-[13px] text-ink">{field.value}</span>;
}

/**
 * Correct-in-place. The .dc.html took only a value; §0.5 requires a reason —
 * submit stays impossible until BOTH are non-empty (and the mock 422s an
 * empty reason regardless).
 */
function EditForm({
  seed,
  onCommit,
  onCancel,
}: {
  seed: string;
  onCommit: (value: string, reason: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(seed);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const trySubmit = () => {
    if (value.trim() && reason.trim()) onCommit(value.trim(), reason.trim());
    else setTried(true);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") trySubmit();
    else if (e.key === "Escape") onCancel();
  };
  return (
    <div
      className="flex w-full flex-col gap-[5px]"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        data-testid="edit-value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        className="w-[220px] rounded-[3px] border border-action bg-card px-[6px] py-[2px] font-mono text-[13px]"
      />
      <input
        data-testid="edit-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={onKey}
        placeholder="why — required, recorded with the correction"
        className="w-full max-w-[340px] rounded-[3px] border border-dash bg-input px-[6px] py-[2px] font-sans text-[12px]"
      />
      {tried && !(value.trim() && reason.trim()) ? (
        <span data-testid="nudge" className="text-[10.5px] font-semibold text-attend">
          held — a correction needs both the value and its why.
        </span>
      ) : (
        <span className="text-[10.5px] text-ink-dim">
          ⏎ save (needs value + why) · esc cancel
        </span>
      )}
    </div>
  );
}

function ConfidenceBar({ field }: { field: Field }) {
  if (field.engine_confidence_raw === null) {
    // "returned nothing" may only be claimed when the readings agree —
    // saying it above two visible candidate values is a contradiction.
    const anyFound = (field.readings ?? []).some((r) => r.value !== null);
    if (field.state === "needs_review" && field.value === null && !anyFound) {
      return (
        <div className="mb-2 text-[12px] text-dk-ink-soft">
          No confidence to show — extraction returned nothing at all.
        </div>
      );
    }
    return null;
  }
  const n = 20;
  const filled = Math.round(field.engine_confidence_raw * n);
  const on = field.state === "needs_review" ? "bg-attend-border" : "bg-ok-soft";
  return (
    <div className="mb-2">
      <div className="flex h-3 max-w-[420px] gap-[2px]">
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-[1px] ${i < filled ? on : "bg-dk-line-2"}`}
          />
        ))}
      </div>
      <div className="mt-[7px] text-[12px] text-dk-ink-soft">
        {field.engine_id} · {field.engine_confidence_raw.toFixed(2)} — the
        engine grading its own work. Shown for context; it decides nothing.
      </div>
    </div>
  );
}

function ReadingsPanel({
  field,
  pinnedReadingId,
  onPin,
  onUse,
}: {
  field: Field;
  pinnedReadingId: string | null;
  onPin: (readingId: string) => void;
  onUse?: ((value: string) => void) | undefined;
}) {
  const readings = field.readings ?? [];
  const disagree = readingsDisagree(field);
  return (
    <div className="mb-2 max-w-[560px] rounded-btn border border-neutral bg-dk-info-bg px-[11px] py-[9px]">
      <div className="mb-[7px] text-[11px] font-bold tracking-[.08em] text-dk-info">
        {disagree
          ? "TWO ENGINES READ THIS PAGE INDEPENDENTLY — THEY DISAGREE. THAT IS WHY IT IS YOURS."
          : "TWO ENGINES READ THIS PAGE INDEPENDENTLY — THEY AGREE; A LOW-QUALITY SCAN REGION ROUTED IT TO YOU ANYWAY."}
      </div>
      {readings.map((r, i) => (
        <ReadingCard
          key={r.id}
          reading={r}
          seat={`READER ${String.fromCharCode(65 + i)}`}
          pinned={pinnedReadingId === r.id}
          pinnable={parseLineCoords(r.line_coords).length > 0}
          onPin={() => onPin(r.id)}
          compareTo={
            disagree
              ? (readings.find((o) => o.id !== r.id)?.value ?? null)
              : null
          }
          onUse={onUse}
        />
      ))}
      {disagree && (
        <div className="mt-[6px] text-[11px] leading-normal text-ink-dim">
          A and B agreeing (plus validators) would have auto-confirmed this
          field — no human. They disagreed, so it is yours. Neither engine’s
          self-reported confidence had a vote.
        </div>
      )}
    </div>
  );
}

function ResolutionNote({ field }: { field: Field }) {
  let note: string | null = null;
  if (field.na_reason === "NOT_PRESENT") {
    note =
      "Structurally absent for this county/parcel — renders “Not Available” by design. Not in your queue; nothing to confirm.";
  } else if (field.state === "escalated") {
    note =
      "Escalated — in the inbox, off your plate, not forgotten. The order still ships; nothing here is held by it.";
  } else if (field.state === "corrected") {
    note = "Corrected and recorded. Both count as evidence.";
  } else if (field.state === "confirmed" && field.approved_by !== null) {
    note = "Confirmed and recorded. Both count as evidence.";
  } else if (field.state === "pending") {
    note = "Not yet extracted — the pipeline has not reached this field.";
  } else if (provenanceMissing(field)) {
    note =
      "⚠ This value arrived with an empty provenance envelope — no page, no snippet, no document. A value with nothing behind it is the enemy; treat it as unverified and file a pipeline bug.";
  }
  if (note === null) return null;
  return (
    <div className="mb-2 max-w-[560px] rounded-btn border border-dk-line-2 bg-dk-card px-[10px] py-2 text-[12.5px] leading-normal text-dash">
      {note}
    </div>
  );
}

function ActionRow({
  field,
  onConfirm,
  onCorrect,
  onEscalate,
}: {
  field: Field;
  onConfirm: () => void;
  onCorrect: () => void;
  onEscalate: () => void;
}) {
  const missing = field.value === null;
  const primary =
    "flex cursor-pointer items-center gap-2 rounded-btn border border-action bg-action px-4 py-2 font-sans text-[13px] font-semibold text-ink-invert";
  const secondary =
    "flex cursor-pointer items-center gap-2 rounded-btn border border-label bg-transparent px-4 py-2 font-sans text-[13px] font-semibold text-dk-ink";
  const tertiary =
    "flex cursor-pointer items-center gap-2 rounded-btn border border-dk-attend-border bg-transparent px-4 py-2 font-sans text-[13px] font-semibold text-dk-attend";
  const kbdP = "rounded-chip bg-btn-key px-[5px] font-mono text-[10.5px] text-ink-invert";
  const kbdS = "rounded-chip bg-dk-line-2 px-[5px] font-mono text-[10.5px] text-dk-ink-soft";
  const kbdA = "rounded-chip bg-dk-attend-kbd px-[5px] font-mono text-[10.5px] text-dk-attend";
  return (
    <div className="mt-1 flex gap-[10px]">
      {missing ? (
        <>
          <button type="button" onClick={onCorrect} className={primary} data-testid="act-correct">
            Correct — type it from the page<span className={kbdP}>C</span>
          </button>
          {/* No keyboard shortcut ON PURPOSE: accepting nothing must never
              share a key with accepting a value — a click is the friction. */}
          <button type="button" onClick={onConfirm} className={secondary} data-testid="act-confirm">
            Accept as Not Available — click to be sure
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={onConfirm} className={primary} data-testid="act-confirm">
            Confirm — matches source<span className={kbdP}>⏎</span>
          </button>
          <button type="button" onClick={onCorrect} className={secondary} data-testid="act-correct">
            Correct in place<span className={kbdS}>C</span>
          </button>
        </>
      )}
      <button type="button" onClick={onEscalate} className={tertiary} data-testid="act-escalate">
        Escalate — I don’t know the rule<span className={kbdA}>E</span>
      </button>
    </div>
  );
}

function SourcePane({
  field,
  pinnedReadingId,
  scrollNonce,
}: {
  field: Field;
  pinnedReadingId: string | null;
  scrollNonce: number;
}) {
  const pinned: FieldReading | undefined = (field.readings ?? []).find(
    (r) => r.id === pinnedReadingId,
  );
  const page =
    pinned?.page ??
    field.source_page ??
    (field.readings ?? []).find((r) => r.page !== null)?.page ??
    null;

  if (page === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-[30px]">
        <NoPageBox field={field} />
      </div>
    );
  }

  const highlights: PdfHighlight[] = [];
  const unresolvedReview = field.state === "needs_review";
  if (field.source_snippet !== null) {
    highlights.push({
      id: "main",
      rects: parseLineCoords(field.source_line_coords).filter(
        (r) => r.page === page,
      ),
      tone: unresolvedReview ? "attend" : "ok",
      chip: "EXTRACTED FROM HERE",
      snippet: field.source_snippet,
    });
  } else if (unresolvedReview && field.value === null && !pinned) {
    highlights.push({
      id: "main",
      rects: [],
      tone: "act",
      chip:
        field.na_reason === "PRESENT_UNREADABLE"
          ? "PRESENT — UNREADABLE AT EVERY ENGINE"
          : "EXTRACTION FOUND NOTHING HERE",
      snippet: "",
    });
  }
  if (pinned) {
    highlights.push({
      id: `pin-${pinned.id}`,
      rects: parseLineCoords(pinned.line_coords).filter((r) => r.page === page),
      tone: "pin",
      chip: `⌖ READER B LINE — ${pinned.engine_id} coordinates`,
    });
  }

  const srcChip = field.engine_id ?? (field.readings?.length ? "TWO READERS" : "");

  return (
    <>
      <div className="flex flex-none items-center justify-between border-b border-dk-line px-[18px] py-2 text-[12px] text-dk-ink-soft">
        <div className="flex items-baseline gap-[10px]">
          <span className="font-semibold text-dk-ink">
            {field.source_doc_id ?? "source"}
          </span>
          <span className="text-ink-dim">showing p {page}</span>
        </div>
        {srcChip !== "" && (
          <span className="rounded-chip border border-dk-ok-border px-2 py-[2px] font-mono text-[10px] font-bold tracking-[.08em] text-dk-ok uppercase">
            {srcChip}
          </span>
        )}
      </div>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-[12px] text-ink-dim">
            loading source pane…
          </div>
        }
      >
        <PdfPane
          fileUrl={null}
          page={page}
          pageStamp={`PAGE ${page}`}
          highlights={highlights}
          scrollKey={`${field.id}-${pinnedReadingId ?? ""}-${scrollNonce}`}
        />
      </Suspense>
    </>
  );
}

/** The three legitimately page-less renders — each visibly distinct (§0.3/§0.8). */
function NoPageBox({ field }: { field: Field }) {
  let title = "No source page";
  let body = "Nothing in the package is cited for this field.";
  let toneClass = "border-dk-line-2 text-dash";
  if (field.na_reason === "NOT_PRESENT") {
    title = "Structurally absent";
    body =
      "This jurisdiction doesn’t record the field — it renders “Not Available” on the report. That is expected, not a defect, and it is not in your queue.";
  } else if (field.state === "pending") {
    title = "Not yet extracted";
    body = "The pipeline has not produced a reading for this field yet.";
  } else if (provenanceMissing(field)) {
    title = "Confirmed with no provenance — flagged";
    body =
      "A value with nothing behind it, presented confidently. The server let it through; the UI will not present it as normal. File a pipeline bug.";
    toneClass = "border-dk-act-border text-dk-act";
  }
  return (
    <div
      className={`max-w-[400px] rounded-[8px] border-[1.5px] border-dashed px-8 py-9 text-center ${toneClass}`}
      data-testid="no-page-box"
    >
      <div className="mb-3 font-mono text-[22px] text-label">— no page —</div>
      <div className="mb-2 text-[14px] font-semibold text-dk-ink">{title}</div>
      <div className="text-[12.5px] leading-[1.55]">{body}</div>
    </div>
  );
}
