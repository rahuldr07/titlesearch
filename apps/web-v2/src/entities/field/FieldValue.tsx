import { PageChip } from "./PageChip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * A field that HAS a value.
 *
 * The load-bearing rule, and the reason `provenance` is a required prop rather
 * than an optional one: **a value with no provenance renders as a hard error,
 * never a bare value** (`review.spec` #2, INVARIANT; principle 6 — never emit a
 * value you cannot cite). The design has no error arm for this, so the
 * treatment below is INVENTED and flagged — see `conflicts.md`. Everything else
 * here is drawn.
 *
 * Making `provenance` required-but-nullable is deliberate. Optional would let a
 * caller omit it by accident and render a bare, uncited value — the exact
 * failure the invariant exists to catch. Nullable forces the caller to say
 * "there is none", and then this component decides what that looks like.
 *
 * `raw` is separate from `value` because BRIEF §8 forbids merging
 * `value_raw` and `value_normalized`: the normalisation is the machine's
 * interpretation, and a reviewer checking a value against the page needs to see
 * what was actually on the page.
 */
export interface Provenance {
  page: number;
  /** The exact text the value was read from. Never paraphrased. */
  snippet: string;
}

export type FieldPresentation =
  | "machine"
  | "correction"
  | "excluded"
  | "escalated"
  | "note";

const PRESENTATION: Record<FieldPresentation, { className: string; mark?: string }> = {
  machine: { className: "font-mono text-md text-ink-primary" },
  correction: {
    className:
      "rounded-1 border-b-(length:--stroke-emphasis) border-action bg-action-surface px-2 py-px font-mono text-md font-semibold text-action-ink",
    mark: "Your correction",
  },
  excluded: {
    className: "font-mono text-md text-ink-secondary line-through",
    mark: "Excluded — not our party",
  },
  escalated: {
    className: "font-mono text-md text-state-attend-ink",
    mark: "↗ Escalated to senior review",
  },
  note: { className: "font-quote text-base text-ink-secondary" },
};

export function FieldValue({
  value,
  raw,
  provenance,
  presentation = "machine",
  onViewSource,
}: {
  value: string;
  /** `value_raw`, when it differs from the normalised value. Never merged. */
  raw?: string;
  /** `null` means none exists — which is an error, not an omission. */
  provenance: Provenance | null;
  presentation?: FieldPresentation;
  onViewSource?: (page: number) => void;
}) {
  if (provenance === null) {
    return (
      <span
        role="alert"
        className="inline-flex items-center gap-3 rounded-4 border border-state-halt-border bg-state-halt-surface px-4 py-2 text-xs font-semibold text-state-halt-ink"
      >
        <span aria-hidden>⚠</span>
        NO PROVENANCE — this value cannot be shown without its source
      </span>
    );
  }

  const { className, mark } = PRESENTATION[presentation];

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <span className={cn(className)}>{value}</span>
      <PageChip page={provenance.page} onView={onViewSource} />
      {raw !== undefined && raw !== value ? (
        <span className="font-mono text-xs text-ink-muted">
          <span className="sr-only">As printed on the page: </span>
          raw: {raw}
        </span>
      ) : null}
      {mark ? (
        <Eyebrow variant="field">{mark}</Eyebrow>
      ) : null}
    </span>
  );
}
