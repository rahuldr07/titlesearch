import type { ClientOverride, EffectiveLine, LineApplication } from "@titlepipe/contract";

import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";

import { treatmentLabel } from "./compare";

/**
 * One resolved line, carrying its ORIGIN.
 *
 * Every row says where it came from — this baseline, or added for this client —
 * because a line with no traceable source is a config defect in exactly the way
 * a value with no provenance is an extraction defect. It is the same discipline
 * applied one layer up: never emit something you cannot cite.
 *
 * An excluded line is STRUCK THROUGH AND STILL PRESENT rather than removed.
 * Absence would be indistinguishable from a line the baseline never had, and
 * the whole point of the panel is that the difference is visible and deliberate.
 */
const TONE: Readonly<Record<LineApplication, "neutral" | "attend" | "halt">> = {
  applies: "neutral", narrowed: "attend", excluded: "halt",
};

export function EffectiveRow({
  line,
  override,
  source,
}: {
  line: EffectiveLine;
  /** The delta that moved this line off the baseline, or null if none did. */
  override: ClientOverride | null;
  /** "Two Owner Search baseline", or "added for Sample Client — Riverbend Title". */
  source: string;
}) {
  const struck = line.application === "excluded";

  return (
    <li
      data-testid={`effective-${line.line_id}`}
      className="flex items-start gap-6 border-t border-line-subtle py-5 first:border-t-0"
    >
      <span className="w-11 shrink-0 pt-1 font-mono text-xs font-semibold text-ink-muted">
        {line.n}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-base font-medium leading-close",
            struck ? "text-ink-muted line-through" : "text-ink-primary",
          )}
        >
          {line.label}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <span
            className={cn(
              "text-micro font-bold uppercase tracking-label",
              override?.type === "add" ? "text-action" : "text-ink-muted",
            )}
          >
            {source}
          </span>
          {line.scope_note === null ? null : (
            <span className="text-xs leading-close text-ink-secondary">
              · {line.scope_note}
            </span>
          )}
          {override === null ? null : (
            <span className="text-xs leading-close text-ink-secondary">
              · {override.note}
            </span>
          )}
        </div>
      </div>
      <Chip
        tone={override?.type === "waive" ? "halt" : TONE[line.application]}
        size="micro"
        bordered
        className="shrink-0"
      >
        {treatmentLabel(override)}
      </Chip>
    </li>
  );
}
