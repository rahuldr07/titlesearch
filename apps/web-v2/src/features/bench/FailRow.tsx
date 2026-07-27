import { Link } from "@tanstack/react-router";
import type { BenchFailRow } from "@titlepipe/contract";
import { cn } from "../../shared/ui/classNames";

/**
 * WHAT A FAILURE MEANS DEPENDS ENTIRELY ON THE SEED IT WAS GRADED AGAINST, and
 * that is the whole reason the tag rides every row (`bench.spec` #2).
 *
 * Against a RULED seed a human has already settled the answer, so a failure is
 * the model's and is always actionable. Against a SUSPECT seed the seed itself
 * came from a defect-prone source — the model may be right and the seed wrong,
 * and optimising against that cell teaches the model to reproduce a defect.
 *
 * Deriving this from the tag rather than reading a `note` off the wire is
 * deliberate: the sentence must be true of every row with that tag, including
 * rows the fixtures have not thought of yet.
 */
function verdict(row: BenchFailRow): { text: string; tone: string } {
  if (row.tag === "ruled") {
    return {
      text: "FAIL — ruled seed, always actionable",
      tone: "font-bold text-state-halt-ink",
    };
  }
  if (row.tag === "suspect") {
    return {
      text: "FAIL? — suspect seed; may be the seed, not the model",
      tone: "text-state-attend-ink",
    };
  }
  return { text: "FAIL", tone: "text-state-halt-ink" };
}

interface FailRowProps {
  row: BenchFailRow;
  expanded: boolean;
  onToggle: () => void;
}

export function FailRow({ row, expanded, onToggle }: FailRowProps) {
  const { text, tone } = verdict(row);

  return (
    <li className="border-t border-line-subtle first:border-t-0">
      <button
        type="button"
        data-testid={`fail-${row.path}`}
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full flex-wrap items-baseline gap-5 px-8 py-4 text-left"
      >
        <span aria-hidden className="text-state-halt-ink">
          ✗
        </span>
        <span className="w-64 font-mono text-xs text-ink-primary">{row.path}</span>
        <span className="font-mono text-micro tracking-badge text-ink-muted">{row.tag}</span>
        <span className={cn("flex-1 text-xs", tone)}>{text}</span>
      </button>

      {expanded ? (
        <dl className="grid grid-cols-[6rem_1fr] gap-x-6 gap-y-2 border-l-2 border-line-strong bg-surface-sunken px-8 py-5">
          <dt className="font-mono text-micro tracking-badge text-ink-muted">model</dt>
          <dd className="font-mono text-xs text-ink-primary">{row.model_value ?? "∅"}</dd>
          <dt className="font-mono text-micro tracking-badge text-ink-muted">seed</dt>
          <dd className="font-mono text-xs text-ink-primary">{row.seed_value ?? "∅"}</dd>
          <dt className="font-mono text-micro tracking-badge text-ink-muted">source</dt>
          <dd className="text-xs leading-body text-ink-secondary">{row.source_note ?? "∅"}</dd>
          {row.golden_field_id === null ? null : (
            <>
              <dt />
              <dd>
                <Link
                  to="/seed-correction"
                  search={{ fieldId: row.golden_field_id }}
                  className="text-xs font-semibold text-action underline"
                >
                  Investigate seed →
                </Link>
              </dd>
            </>
          )}
        </dl>
      ) : null}
    </li>
  );
}
