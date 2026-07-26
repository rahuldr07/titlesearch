import type { Field, FieldReading, NaReason } from "@titlepipe/contract";

/**
 * Field primitives (frontend-master-prompt §3) — the ONLY place the NA-state
 * rendering rules live. The two NA states render as the same words and route
 * oppositely (CONTEXT §11); a null/null pair is "not yet extracted", a third
 * distinct render. Nothing here computes state — `state` and `na_reason`
 * arrive from the server and render verbatim.
 */

/** True when a value arrived with an empty provenance envelope — principle 6's failure shape. */
export function provenanceMissing(f: Field): boolean {
  return (
    f.value !== null &&
    f.source_page === null &&
    f.source_snippet === null &&
    f.source_doc_id === null
  );
}

/** Do the (≥2) readings disagree as displayed? Presentation only — the server already routed. */
export function readingsDisagree(f: Field): boolean {
  const r = f.readings ?? [];
  if (r.length < 2) return false;
  return new Set(r.map((x) => x.value)).size > 1;
}

export function fieldLabel(path: string): string {
  const parts = path.split(".");
  const head = parts[0] ?? "";
  if (parts.length === 3 && /^\d+$/.test(parts[1] ?? "")) {
    const sec =
      head === "mortgages" ? "MTG" : head === "judgments" ? "JGMT" : head.toUpperCase();
    return `${sec} ${parts[1]} — ${(parts[2] ?? "").replace(/_/g, " ").toUpperCase()}`;
  }
  return parts.slice(-2).join(" ").replace(/_/g, " ").toUpperCase();
}

/** Section grouping is by path head — presentation only; server order is preserved within. */
export function sectionOf(path: string): string {
  const head = path.split(".")[0] ?? "";
  const titles: Record<string, string> = {
    owner: "CURRENT OWNER",
    legal: "LEGAL DESCRIPTION",
    deed: "DEED",
    mortgages: "MORTGAGES",
    assessment: "TAXES",
    judgments: "JUDGMENTS & LIENS",
  };
  return titles[head] ?? head.toUpperCase();
}

/**
 * Draft value for display on an unresolved disagreement: when the server sent
 * no merged value but ≥2 readings carry candidates, Reader A's candidate
 * renders as the draft (tagged A≠B — never presented as settled).
 */
export function displayDraft(f: Field): string | null {
  if (f.value !== null) return f.value;
  if (f.state !== "needs_review") return null;
  const withValues = (f.readings ?? []).filter((r) => r.value !== null);
  if (withValues.length >= 2) return withValues[0]?.value ?? null;
  return null;
}

/**
 * Value text per §0.3. Both NA states read "Not Available" — the chips and
 * styling around them differ, never the words.
 */
export function naText(
  value: string | null,
  naReason: NaReason | null,
  state: Field["state"],
): string {
  if (value !== null) return value;
  if (naReason !== null) return "Not Available";
  if (state === "pending") return "not yet extracted";
  return "Not Available";
}

export interface ChipSpec {
  label: string;
  className: string;
}

const chipBase =
  "rounded-xs px-[6px] py-px text-[9.5px] font-bold tracking-[.07em] whitespace-nowrap ";

/** Row chips for a field (light register). Order matters — first chip leads. */
export function fieldChips(f: Field): ChipSpec[] {
  const chips: ChipSpec[] = [];
  if (f.state === "needs_review") {
    if (f.na_reason === "PRESENT_UNREADABLE") {
      chips.push({
        label: "PRESENT — UNREADABLE",
        className: chipBase + "border-[1.5px] border-state-halt bg-surface-panel text-state-halt",
      });
    } else if (f.value === null && !readingsDisagree(f)) {
      chips.push({
        label: "MISSING FROM CAPTURE",
        className: chipBase + "border-[1.5px] border-state-halt bg-surface-panel text-state-halt",
      });
    }
    if (f.engine_confidence_raw !== null) {
      chips.push({
        label: `OCR ${f.engine_confidence_raw.toFixed(2)}`,
        className:
          chipBase + "border border-state-attend-border bg-state-attend-surface text-state-attend",
      });
    }
    if (readingsDisagree(f)) {
      const bFound =
        f.value === null &&
        (f.readings ?? []).some((r) => r.value === null) &&
        (f.readings ?? []).some((r) => r.value !== null);
      chips.push(
        bFound
          ? {
              label: "READER B FOUND A LINE",
              className:
                chipBase +
                "border border-state-idle-border bg-state-idle-surface text-state-idle",
            }
          : {
              label: "A≠B",
              className:
                chipBase +
                "border border-state-idle-border bg-state-idle-surface text-state-idle",
            },
      );
    }
  }
  if (f.na_reason === "NOT_PRESENT") {
    chips.push({
      label: "N/A — EXPECTED",
      className: chipBase + "border border-line-strong bg-track text-ink-secondary",
    });
  }
  if (provenanceMissing(f)) {
    // §0.8: a value that arrived with nothing behind it is never silently normal.
    chips.push({
      label: "NO PROVENANCE",
      className: chipBase + "border-[1.5px] border-state-halt bg-state-halt-surface text-state-halt",
    });
  }
  return chips;
}

/** Bottom-panel state chip (dark register). Rendered verbatim from server state. */
export function statePill(f: Field): ChipSpec {
  const base =
    "rounded-xs px-2 py-[2px] text-[10px] font-bold tracking-[.08em] ";
  if (f.na_reason === "NOT_PRESENT") {
    return {
      label: "N/A — EXPECTED, NOT QUEUED",
      className: base + "border border-ink-secondary text-ink-secondary",
    };
  }
  switch (f.state) {
    case "needs_review":
      if (f.na_reason === "PRESENT_UNREADABLE") {
        return {
          label: "PRESENT — UNREADABLE",
          className: base + "border border-state-halt bg-state-halt text-ink-on-action",
        };
      }
      if (f.value === null && readingsDisagree(f)) {
        // Say what the readings actually show: "A empty, B found" only when
        // that is true — with two found-but-different values, claiming
        // emptiness contradicts the evidence 20px below and kills trust.
        const someEmpty = (f.readings ?? []).some((r) => r.value === null);
        return someEmpty
          ? {
              label: "ENGINES DISAGREE — A EMPTY, B FOUND",
              className: base + "border border-state-halt bg-state-halt text-ink-on-action",
            }
          : {
              label: "ENGINES DISAGREE — NOTHING SETTLED",
              className: base + "border border-state-halt bg-state-halt text-ink-on-action",
            };
      }
      if (f.value === null) {
        return {
          label: "MISSING — REAL DEFECT",
          className: base + "border border-state-halt bg-state-halt text-ink-on-action",
        };
      }
      if (readingsDisagree(f)) {
        return {
          label: "ENGINES DISAGREE — VERIFY",
          className: base + "border border-document-attend-border text-document-attend",
        };
      }
      return {
        label: "NEEDS REVIEW — VERIFY",
        className: base + "border border-document-attend-border text-document-attend",
      };
    case "auto_confirmed":
      return {
        label: "AUTO-CONFIRMED",
        className: base + "border border-document-settled-border text-document-settled",
      };
    case "confirmed":
      return {
        label: "CONFIRMED",
        className: base + "border border-document-settled-border text-document-settled",
      };
    case "corrected":
      return {
        label: "CORRECTED",
        className: base + "border border-document-settled-border text-document-settled",
      };
    case "escalated":
      return {
        label: "ESCALATED — IN THE INBOX",
        className: base + "border border-document-attend-border text-document-attend",
      };
    case "pending":
      return {
        label: "PENDING — NOT YET EXTRACTED",
        className: base + "border border-document-line-strong text-document-ink-soft",
      };
  }
}

/** "p 29 · “snippet”" — the provenance line. Click = jump to source. */
export function ProvenanceLine({
  field,
  onJump,
}: {
  field: Field;
  onJump?: (() => void) | undefined;
}) {
  if (field.source_page === null && field.source_snippet === null) return null;
  return (
    <button
      type="button"
      onClick={onJump}
      className="cursor-pointer border-none bg-transparent p-0 text-left font-mono text-[10.5px] text-ink-secondary hover:text-page-ref"
    >
      {field.source_page !== null && <>p {field.source_page}</>}
      {field.source_snippet !== null && <> · “{field.source_snippet}”</>}
    </button>
  );
}

/**
 * Character-level diff against the other reader's value. OCR failure modes
 * are single-glyph (O vs 0, 6 vs 8) at 12px mono — older eyes miss them;
 * the highlight does the squinting. Positional compare is deliberate: the
 * variants are same-shape strings, and a smarter diff would imply an
 * alignment judgment the UI has no business making.
 */
function DiffChars({ value, other }: { value: string; other: string }) {
  return (
    <>
      {[...value].map((ch, i) =>
        ch === (other[i] ?? null) ? (
          ch
        ) : (
          <span
            key={i}
            data-testid="diff-hl"
            className="rounded-[2px] bg-state-halt px-px text-ink-on-action"
          >
            {ch}
          </span>
        ),
      )}
    </>
  );
}

/**
 * One engine reading (dark register). Readings are labeled by seat position
 * (READER A / READER B) in server order; cost + latency render dimmed —
 * recorded per call, never hidden (CONTEXT §8). With `compareTo`, characters
 * differing from the other reader light up; with `onUse`, the value can be
 * adopted into the correction editor without retyping (the why is still
 * required — deliberateness survives, transcription errors don't).
 */
export function ReadingCard({
  reading,
  seat,
  pinned,
  pinnable,
  onPin,
  compareTo = null,
  onUse,
}: {
  reading: FieldReading;
  seat: string;
  pinned: boolean;
  pinnable: boolean;
  onPin?: (() => void) | undefined;
  compareTo?: string | null;
  onUse?: ((value: string) => void) | undefined;
}) {
  const v = reading.value;
  return (
    <div
      onClick={pinnable ? onPin : undefined}
      className={`mb-[2px] grid grid-cols-[150px_1fr] items-start gap-3 rounded-[3px] border px-[7px] py-[5px] ${
        pinned
          ? "border-page-ref-border bg-document-info-row"
          : pinnable
            ? "cursor-pointer border-document-line-strong"
            : "border-transparent"
      }`}
    >
      <div>
        <div className="text-[10px] font-bold tracking-[.07em] text-document-info">
          {seat}
        </div>
        <div className="font-mono text-[10.5px] text-ink-secondary">
          {reading.engine_id}
        </div>
      </div>
      <div className="min-w-0">
        <div
          className={`font-mono text-[12.5px] ${
            v === null ? "text-document-halt" : "text-document-ink-strong"
          }`}
        >
          {v === null ? (
            "∅ returned nothing"
          ) : compareTo !== null && compareTo !== v ? (
            <DiffChars value={v} other={compareTo} />
          ) : (
            v
          )}
        </div>
        {reading.snippet !== null && (
          <div className="mt-[2px] text-[10.5px] text-ink-secondary">
            “{reading.snippet}”
            {pinnable && <> · ⌖ click to pin the exact line</>}
          </div>
        )}
        <div className="mt-[2px] flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-[10px] text-ink-secondary">
            ${reading.cost_usd.toFixed(4)} · {(reading.latency_ms / 1000).toFixed(1)}s
          </span>
          {v !== null && onUse !== undefined && (
            <button
              type="button"
              data-testid={`use-${reading.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onUse(v);
              }}
              className="cursor-pointer rounded-[3px] border border-state-idle bg-transparent px-[6px] py-px font-sans text-[10px] font-semibold text-page-ref-border"
            >
              correct to this — the why is still yours
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
