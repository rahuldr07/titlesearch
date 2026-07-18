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
  "rounded-chip px-[6px] py-px text-[9.5px] font-bold tracking-[.07em] whitespace-nowrap ";

/** Row chips for a field (light register). Order matters — first chip leads. */
export function fieldChips(f: Field): ChipSpec[] {
  const chips: ChipSpec[] = [];
  if (f.state === "needs_review") {
    if (f.na_reason === "PRESENT_UNREADABLE") {
      chips.push({
        label: "PRESENT — UNREADABLE",
        className: chipBase + "border-[1.5px] border-act bg-card text-act",
      });
    } else if (f.value === null && !readingsDisagree(f)) {
      chips.push({
        label: "MISSING FROM CAPTURE",
        className: chipBase + "border-[1.5px] border-act bg-card text-act",
      });
    }
    if (f.engine_confidence_raw !== null) {
      chips.push({
        label: `OCR ${f.engine_confidence_raw.toFixed(2)}`,
        className:
          chipBase + "border border-attend-border bg-chip-low-bg text-attend",
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
                "border border-neutral-border bg-neutral-bg text-neutral",
            }
          : {
              label: "A≠B",
              className:
                chipBase +
                "border border-neutral-border bg-neutral-bg text-neutral",
            },
      );
    }
  }
  if (f.na_reason === "NOT_PRESENT") {
    chips.push({
      label: "N/A — EXPECTED",
      className: chipBase + "border border-line bg-track text-ink-dim",
    });
  }
  if (provenanceMissing(f)) {
    // §0.8: a value that arrived with nothing behind it is never silently normal.
    chips.push({
      label: "NO PROVENANCE",
      className: chipBase + "border-[1.5px] border-act bg-act-bg text-act",
    });
  }
  return chips;
}

/** Bottom-panel state chip (dark register). Rendered verbatim from server state. */
export function statePill(f: Field): ChipSpec {
  const base =
    "rounded-chip px-2 py-[2px] text-[10px] font-bold tracking-[.08em] ";
  if (f.na_reason === "NOT_PRESENT") {
    return {
      label: "N/A — EXPECTED, NOT QUEUED",
      className: base + "border border-ink-secondary text-ink-dim",
    };
  }
  switch (f.state) {
    case "needs_review":
      if (f.na_reason === "PRESENT_UNREADABLE") {
        return {
          label: "PRESENT — UNREADABLE",
          className: base + "border border-act bg-act text-ink-invert",
        };
      }
      if (f.value === null && readingsDisagree(f)) {
        return {
          label: "ENGINES DISAGREE — A EMPTY, B FOUND",
          className: base + "border border-act bg-act text-ink-invert",
        };
      }
      if (f.value === null) {
        return {
          label: "MISSING — REAL DEFECT",
          className: base + "border border-act bg-act text-ink-invert",
        };
      }
      if (readingsDisagree(f)) {
        return {
          label: "ENGINES DISAGREE — VERIFY",
          className: base + "border border-dk-attend-border text-dk-attend",
        };
      }
      return {
        label: "NEEDS REVIEW — VERIFY",
        className: base + "border border-dk-attend-border text-dk-attend",
      };
    case "auto_confirmed":
      return {
        label: "AUTO-CONFIRMED",
        className: base + "border border-dk-ok-border text-dk-ok",
      };
    case "confirmed":
      return {
        label: "CONFIRMED",
        className: base + "border border-dk-ok-border text-dk-ok",
      };
    case "corrected":
      return {
        label: "CORRECTED",
        className: base + "border border-dk-ok-border text-dk-ok",
      };
    case "escalated":
      return {
        label: "ESCALATED — IN THE INBOX",
        className: base + "border border-dk-attend-border text-dk-attend",
      };
    case "pending":
      return {
        label: "PENDING — NOT YET EXTRACTED",
        className: base + "border border-dk-line-2 text-dk-ink-soft",
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
      className="cursor-pointer border-none bg-transparent p-0 text-left font-mono text-[10.5px] text-ink-dim hover:text-action"
    >
      {field.source_page !== null && <>p {field.source_page}</>}
      {field.source_snippet !== null && <> · “{field.source_snippet}”</>}
    </button>
  );
}

/**
 * One engine reading (dark register). Readings are labeled by seat position
 * (READER A / READER B) in server order; cost + latency render dimmed —
 * recorded per call, never hidden (CONTEXT §8).
 */
export function ReadingCard({
  reading,
  seat,
  pinned,
  pinnable,
  onPin,
}: {
  reading: FieldReading;
  seat: string;
  pinned: boolean;
  pinnable: boolean;
  onPin?: (() => void) | undefined;
}) {
  return (
    <div
      onClick={pinnable ? onPin : undefined}
      className={`mb-[2px] grid grid-cols-[150px_1fr] items-start gap-3 rounded-[3px] border px-[7px] py-[5px] ${
        pinned
          ? "border-action-border bg-dk-info-row"
          : pinnable
            ? "cursor-pointer border-dk-line-2"
            : "border-transparent"
      }`}
    >
      <div>
        <div className="text-[10px] font-bold tracking-[.07em] text-dk-info">
          {seat}
        </div>
        <div className="font-mono text-[10.5px] text-ink-dim">
          {reading.engine_id}
        </div>
      </div>
      <div className="min-w-0">
        <div
          className={`font-mono text-[12.5px] ${
            reading.value === null ? "text-dk-act" : "text-dk-ink-strong"
          }`}
        >
          {reading.value ?? "∅ returned nothing"}
        </div>
        {reading.snippet !== null && (
          <div className="mt-[2px] text-[10.5px] text-ink-dim">
            “{reading.snippet}”
            {pinnable && <> · ⌖ click to pin the exact line</>}
          </div>
        )}
        <div className="mt-[2px] font-mono text-[10px] text-ink-dim">
          ${reading.cost_usd.toFixed(4)} · {(reading.latency_ms / 1000).toFixed(1)}s
        </div>
      </div>
    </div>
  );
}
