import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
  BlindEntriesResponse,
  type BlindConfidence,
  type BlindEntryInput,
  type NaReason,
} from "@titlepipe/contract";
import { api } from "../api";
import { HomeTitle } from "../components/TopBar";

/**
 * Blind Fifty typist capture (frontend-master-prompt §4.12; §0.6 rules are
 * ABSOLUTE). Structurally blind: this screen fetches NOTHING — the capture
 * template below is the static field schema, so no model output, no other
 * seat's data, and no pipeline state can appear here even by accident. The
 * only network call is the submit, whose response is {accepted, entry_ids}
 * and nothing else.
 *
 * Every entry is the three-part contract: value OR na_reason + source
 * citation + certain/probable/unclear. "Unclear with a source" is the job
 * done; a confident guess is the poison. Judgment TYPE takes a second pass —
 * the server enforces the gate; the UI reflects it. No clock, no rate, no
 * score — there is nothing here to be fast at.
 *
 * CONTRACT GAPs: typist seat/order assignment endpoint (seat label is a
 * local placeholder until then).
 */

/** Seat label ONLY — a typist's name never appears in blind-fifty UI or data. */
const SEAT = "typist B";

interface TemplateField {
  path: string;
  label: string;
  /** Judgment TYPE — second-pass gate; `gatedByType` fields stay locked until it records. */
  isType?: boolean;
  gatedByType?: boolean;
  note?: string;
}

const TEMPLATE: { key: string; title: string; jl?: boolean; fields: TemplateField[] }[] = [
  {
    key: "mortgages",
    title: "mortgages",
    fields: [
      { path: "mortgages.1.lender", label: "MTG 1 — LENDER" },
      { path: "mortgages.1.amount", label: "MTG 1 — AMOUNT" },
      { path: "mortgages.1.book_page", label: "MTG 1 — BOOK/PAGE" },
    ],
  },
  {
    key: "assessment",
    title: "assessment",
    fields: [
      { path: "assessment.land", label: "LAND VALUE" },
      { path: "assessment.building", label: "BUILDING VALUE" },
      { path: "assessment.total", label: "TOTAL VALUE" },
    ],
  },
  {
    key: "jl",
    title: "judgments_liens",
    jl: true,
    fields: [
      {
        path: "judgments.1.type",
        label: "JGMT 1 — TYPE",
        isType: true,
        note: "field-level: 3 of 7 known defects were here",
      },
      {
        path: "judgments.1.plaintiff",
        label: "JGMT 1 — PLAINTIFF",
        gatedByType: true,
      },
      {
        path: "judgments.1.amount",
        label: "JGMT 1 — AMOUNT",
        gatedByType: true,
      },
    ],
  },
];

const DOCS = [
  { name: "Warranty deed", pp: "pp 5–7", page: 5 },
  { name: "Security deed", pp: "pp 9–24", page: 9 },
  { name: "Tax bill", pp: "p 27", page: 27 },
  { name: "FiFa search", pp: "pp 31–34", page: 31 },
];

interface Draft {
  value: string;
  na: NaReason | null;
  source: string;
  conf: BlindConfidence | null;
}

const emptyDraft: Draft = { value: "", na: null, source: "", conf: null };

export function BlindFiftyScreen() {
  const { orderId } = useParams({ from: "/blind/$orderId" });
  const [docIdx, setDocIdx] = useState(1);
  const [secKey, setSecKey] = useState("mortgages");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [recorded, setRecorded] = useState<Record<string, BlindEntryInput>>({});
  const [typeConfirmed, setTypeConfirmed] = useState(false);
  const [done, setDone] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      api(BlindEntriesResponse, `/api/blind/${orderId}/entries`, {
        method: "POST",
        body: JSON.stringify({ entries: Object.values(recorded) }),
      }),
    onSuccess: () => setDone(true),
  });

  const sec = TEMPLATE.find((s) => s.key === secKey) ?? TEMPLATE[0];
  const doc = DOCS[docIdx] ?? DOCS[0];
  const entryCount = Object.keys(recorded).length;

  const draftOf = (path: string) => drafts[path] ?? emptyDraft;
  const setDraft = (path: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [path]: { ...(d[path] ?? emptyDraft), ...patch } }));

  /** Three-part contract: (value XOR na_reason) + source + confidence. */
  const complete = (d: Draft) =>
    (d.value.trim() !== "" || d.na !== null) &&
    d.source.trim() !== "" &&
    d.conf !== null;

  const record = (f: TemplateField) => {
    const d = draftOf(f.path);
    if (!complete(d)) return;
    const entry: BlindEntryInput = {
      path: f.path,
      value: d.na !== null ? null : d.value.trim(),
      na_reason: d.na,
      source_citation: d.source.trim(),
      confidence: d.conf ?? "unclear",
    };
    setRecorded((r) => ({ ...r, [f.path]: entry }));
    if (f.isType === true) setTypeConfirmed(true);
  };

  if (done) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-app p-[30px] font-sans text-ink-primary">
        <div
          data-testid="blind-submitted"
          className="max-w-[440px] rounded-md border border-line-strong bg-surface-panel px-8 py-[30px]"
        >
          <div className="text-[15px] font-semibold">Submitted.</div>
          <div className="mt-2 text-[13px] leading-[1.55] text-ink-secondary">
            Reconciliation runs when both typists finish this order. Where you
            diverge, a senior rules on the batch — you are not involved, and
            you will not see the other set of answers.
          </div>
          {/* Never a dead end: this is the least technical user's only
              screen, and their world is capture + account. */}
          <div className="mt-3 text-[13px] leading-[1.55] text-ink-secondary">
            Nothing more is assigned to this seat right now — you're done.
          </div>
          <div className="mt-[14px]">
            <Link
              to="/account"
              data-testid="blind-done-door"
              className="text-[12.5px] font-semibold no-underline"
            >
              Your account →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-surface-app font-sans text-ink-primary">
      <div className="flex flex-none flex-wrap items-baseline justify-between gap-x-[14px] gap-y-2 border-b border-line-strong bg-surface-panel px-[18px] py-[10px]">
        <div className="flex flex-wrap items-baseline gap-[14px]">
          {/* HomeTitle renders PLAIN TEXT for typists — no door out of
              blindness; the link exists only for roles that hold "/" */}
          <HomeTitle
            title="BLIND FIFTY"
            className="text-[12px] font-bold tracking-[.12em] text-ink-secondary"
          />
          <div className="text-[13px] font-semibold" data-testid="blind-seat">
            {SEAT} · order <span className="font-mono">{orderId}</span>
          </div>
          <div className="text-[12px] text-ink-secondary">
            recorded at the field level — leave any time, nothing is lost
          </div>
        </div>
        <span className="rounded-xs border border-dashed border-line-dashed bg-surface-raised px-2 py-[2px] text-[10px] font-bold tracking-[.06em] text-ink-secondary">
          NOTHING TO PEEK AT — no draft, no other typist's answers, no
          suggestions. Not a rule you could break; the screen has no way to
          show them.
        </span>
      </div>
      <div className="flex min-h-0 min-w-[1240px] flex-1">
        {/* document pane */}
        <div className="flex w-[52%] min-w-[540px] flex-col bg-document-bg">
          <div className="flex flex-none flex-wrap items-center gap-[6px] border-b border-document-line px-[18px] py-[10px]">
            {DOCS.map((d, i) => (
              <button
                key={d.name}
                type="button"
                onClick={() => setDocIdx(i)}
                className={`cursor-pointer rounded-[3px] border-none px-[10px] py-[3px] font-sans text-[11.5px] font-semibold ${
                  i === docIdx
                    ? "bg-page-ref text-ink-on-action"
                    : "bg-document-line text-document-ink-soft"
                }`}
              >
                {d.name} <span className="opacity-65">{d.pp}</span>
              </button>
            ))}
            <span className="ml-auto text-[11px] text-ink-secondary">
              the page stays where you left it — there are no suggested
              locations
            </span>
          </div>
          <div className="flex flex-1 justify-center overflow-y-auto px-5 py-6">
            <div className="relative aspect-[8.5/11] w-[min(580px,100%)] flex-none self-start rounded-[2px] bg-page shadow-page">
              <div className="absolute top-7 left-[46px] h-[14px] w-[46%] rounded-[2px] bg-page-bar" />
              <div
                className="absolute top-14 right-[46px] bottom-[42px] left-[46px]"
                style={{
                  background:
                    "repeating-linear-gradient(to bottom, var(--color-page-line) 0 9px, transparent 9px 23px)",
                }}
              />
              <div className="absolute right-[26px] bottom-[14px] font-mono text-[10px] text-ink-muted">
                PAGE {doc?.page} — {doc?.name.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
        {/* capture pane */}
        <div className="flex min-h-0 min-w-[480px] flex-1 flex-col border-l border-line-strong bg-surface-panel">
          <div className="flex flex-none flex-wrap items-baseline gap-[10px] border-b border-line-subtle px-5 py-[10px]">
            {TEMPLATE.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSecKey(s.key)}
                className={`cursor-pointer rounded-[3px] border-none bg-transparent px-[10px] py-1 font-sans text-[12px] font-semibold ${
                  secKey === s.key
                    ? "bg-page-ref-surface text-page-ref shadow-[inset_0_0_0_1px_var(--color-page-ref-border)]"
                    : s.jl === true
                      ? "text-state-attend"
                      : "text-ink-primary"
                }`}
              >
                {s.title}{" "}
                <span className="font-normal text-ink-muted">
                  {s.fields.filter((f) => recorded[f.path]).length} of{" "}
                  {s.fields.length}
                </span>
              </button>
            ))}
          </div>
          {sec?.jl === true && (
            <div className="flex-none border-b border-state-attend-border bg-state-attend-surface px-5 py-[9px] text-[12px] leading-[1.5] text-state-attend-ink">
              3 of 7 known defects in delivered reports were in this section,
              and typist accuracy was lowest here during seed construction.
              Take extra time. Unclear-with-a-source is a better answer than a
              guess marked certain.
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[30px]">
            {sec?.fields.map((f) => (
              <FieldCard
                key={f.path}
                field={f}
                draft={draftOf(f.path)}
                recorded={recorded[f.path]}
                locked={f.gatedByType === true && !typeConfirmed}
                onDraft={(patch) => setDraft(f.path, patch)}
                onRecord={() => record(f)}
                onReopen={() =>
                  setRecorded((r) => {
                    const next = { ...r };
                    delete next[f.path];
                    return next;
                  })
                }
              />
            ))}
            <div className="mt-[14px] flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-testid="blind-submit"
                disabled={entryCount === 0 || submit.isPending}
                onClick={() => submit.mutate()}
                className={`rounded-sm px-4 py-[7px] font-sans text-[12.5px] font-semibold ${
                  entryCount > 0
                    ? "cursor-pointer border border-page-ref bg-page-ref text-ink-on-action"
                    : "cursor-not-allowed border-[1.5px] border-dashed border-line-dashed bg-track text-ink-secondary"
                }`}
              >
                Submit order — {entryCount} field{entryCount === 1 ? "" : "s"}{" "}
                recorded
              </button>
              <span className="text-[11px] text-ink-secondary">
                no clock, no rate, no score — there is nothing here to be fast
                at
              </span>
            </div>
            {submit.error != null && (
              // Deliberate deviation from the shared MutationNote: the copy is
              // FIXED. Nothing server-authored travels into blindness — not
              // even an error string (§0.6; raw messages are a leak vector).
              <div
                data-testid="blind-submit-note"
                className="mt-[6px] text-[11.5px] text-state-attend"
              >
                Not accepted — nothing was recorded. Check your entries and
                submit again.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldCard({
  field,
  draft,
  recorded,
  locked,
  onDraft,
  onRecord,
  onReopen,
}: {
  field: TemplateField;
  draft: Draft;
  recorded: BlindEntryInput | undefined;
  locked: boolean;
  onDraft: (patch: Partial<Draft>) => void;
  onRecord: () => void;
  onReopen: () => void;
}) {
  const [typeGatePassed, setTypeGatePassed] = useState(false);
  if (recorded) {
    return (
      <div
        onClick={onReopen}
        data-testid={`settled-${field.path}`}
        className="mb-2 flex cursor-pointer flex-wrap items-baseline gap-[10px] rounded-sm border border-line-subtle bg-surface-raised px-3 py-2"
      >
        <span className="w-[150px] flex-none text-[11px] font-semibold text-ink-secondary">
          {field.label}
        </span>
        <span className="font-mono text-[12px] text-ink-secondary">
          {recorded.value ?? `Not Available (${recorded.na_reason ?? "—"})`}
        </span>
        <span className="text-[10.5px] text-ink-muted">
          {recorded.source_citation} · {recorded.confidence}
        </span>
        <span className="ml-auto text-[10.5px] text-ink-muted">revisit</span>
      </div>
    );
  }
  if (locked) {
    return (
      <div className="mb-2 rounded-[5px] border border-dashed border-line-strong px-3 py-[10px] text-[11.5px] text-ink-muted">
        {field.label} — opens after TYPE is recorded above (the server holds
        this gate too)
      </div>
    );
  }
  const hasEntry =
    (draft.value.trim() !== "" || draft.na !== null) &&
    draft.source.trim() !== "" &&
    draft.conf !== null;
  const gateNow = field.isType === true && hasEntry && !typeGatePassed;
  const confStyle = (c: BlindConfidence) => {
    if (draft.conf !== c)
      return "border-line-strong bg-surface-panel text-ink-secondary";
    if (c === "unclear") return "border-state-attend-border bg-state-attend-surface text-state-attend";
    if (c === "probable") return "border-ink-secondary bg-surface-raised text-ink-secondary";
    return "border-state-settled-border bg-state-settled-surface text-state-settled";
  };
  return (
    <div
      data-testid={`field-${field.path}`}
      className={`mb-[10px] rounded-md border bg-surface-panel px-4 py-[13px] ${
        gateNow ? "border-state-attend-border" : "border-line-strong"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-[10px]">
        <span className="text-[12px] font-bold tracking-[.04em]">
          {field.label}
        </span>
        {field.note !== undefined && (
          <span className="text-[10.5px] text-state-attend">{field.note}</span>
        )}
      </div>
      {draft.na === null ? (
        <input
          data-testid={`value-${field.path}`}
          value={draft.value}
          onChange={(e) => onDraft({ value: e.target.value })}
          placeholder="value — exactly as the document states it"
          className="mt-2 w-full rounded-sm border border-line-strong bg-surface-panel px-[11px] py-2 font-mono text-[13px]"
        />
      ) : (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="rounded-[3px] border border-line-strong bg-surface-raised px-2 py-1 font-mono text-[12px] text-ink-secondary">
            Not Available —{" "}
            {draft.na === "NOT_PRESENT"
              ? "the package doesn't say"
              : "present but unreadable"}
          </span>
          <button
            type="button"
            onClick={() => onDraft({ na: null })}
            className="cursor-pointer border-none bg-transparent p-0 text-[10.5px] font-semibold text-page-ref"
          >
            clear
          </button>
        </div>
      )}
      <input
        data-testid={`source-${field.path}`}
        value={draft.source}
        onChange={(e) => onDraft({ source: e.target.value })}
        placeholder="source — which instrument, which page (e.g. “security deed 09812/44, p 3”)"
        className="mt-[6px] w-full rounded-sm border border-line-strong bg-surface-panel px-[11px] py-[7px] font-sans text-[12px]"
      />
      <div className="mt-2 flex flex-wrap items-center gap-[6px]">
        {(["certain", "probable", "unclear"] as const).map((c) => (
          <button
            key={c}
            type="button"
            data-testid={`conf-${c}-${field.path}`}
            onClick={() => onDraft({ conf: c })}
            className={`cursor-pointer rounded-[3px] border px-3 py-[3px] font-sans text-[11px] font-semibold ${confStyle(c)}`}
          >
            {c}
          </button>
        ))}
        {draft.na === null && (
          <>
            <button
              type="button"
              onClick={() => onDraft({ na: "NOT_PRESENT", value: "" })}
              className="cursor-pointer rounded-[3px] border border-line-strong bg-transparent px-2 py-[3px] font-sans text-[10px] font-bold tracking-[.04em] text-ink-secondary"
            >
              NOT STATED
            </button>
            <button
              type="button"
              onClick={() => onDraft({ na: "PRESENT_UNREADABLE", value: "" })}
              className="cursor-pointer rounded-[3px] border border-state-attend-border bg-transparent px-2 py-[3px] font-sans text-[10px] font-bold tracking-[.04em] text-state-attend"
            >
              UNREADABLE
            </button>
          </>
        )}
        <span className="text-[10.5px] text-ink-muted">
          unclear + a source is the job done; a guess marked certain corrupts
          the set
        </span>
      </div>
      {gateNow && (
        <div className="mt-[10px] rounded-[5px] border-[1.5px] border-state-attend-border bg-state-attend-surface px-[13px] py-[11px]">
          <div className="text-[11px] font-bold tracking-[.06em] text-state-attend">
            SECOND PASS — TYPE WAS WRONG 3 FOR 3 IN PRIOR REPORTS
          </div>
          <div className="mt-[6px] text-[12.5px] leading-[1.5] text-ink-primary">
            With the document open on the left, read the caption again. You
            entered: <b className="font-mono">{draft.value}</b>. A lis pendens,
            a FiFa, and a judgment look alike in an index and are three
            different things on a report.
          </div>
          <button
            type="button"
            data-testid="type-gate-confirm"
            onClick={() => setTypeGatePassed(true)}
            className="mt-[9px] cursor-pointer rounded-sm border border-state-attend bg-state-attend px-4 py-[7px] font-sans text-[12.5px] font-semibold text-ink-on-action"
          >
            Confirm TYPE — I re-read the caption
          </button>
        </div>
      )}
      {hasEntry && !gateNow && (
        <button
          type="button"
          data-testid={`record-${field.path}`}
          onClick={onRecord}
          className="mt-[10px] cursor-pointer rounded-sm border border-page-ref bg-page-ref px-4 py-[6px] font-sans text-[12px] font-semibold text-ink-on-action"
        >
          Record field
        </button>
      )}
    </div>
  );
}
