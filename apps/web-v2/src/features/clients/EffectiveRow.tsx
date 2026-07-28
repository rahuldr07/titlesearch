import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";

import { TREATMENT_LABEL, type EffectiveLine, type Treatment } from "./effective";

/**
 * One resolved line, carrying its ORIGIN.
 *
 * Every row says where it came from — this baseline, or added for this client —
 * because a line with no traceable source is a config defect in exactly the way
 * a value with no provenance is an extraction defect. It is the same discipline
 * applied one layer up: never emit something you cannot cite.
 *
 * A waived line is STRUCK THROUGH AND STILL PRESENT rather than removed. Absence
 * would be indistinguishable from a line the baseline never had, and the whole
 * point of the panel is that the difference is visible and deliberate.
 */
const TONE: Readonly<Record<Treatment, "neutral" | "attend" | "action" | "halt">> = {
  baseline: "neutral", narrowed: "attend", replaced: "action",
  waived: "halt", added: "action",
};

export function EffectiveRow({
  line,
  source,
}: {
  line: EffectiveLine;
  /** "40-Year Search baseline", or "added for Cactus Title Partners". */
  source: string;
}) {
  const struck = line.treatment === "waived";

  return (
    <li
      data-testid={`effective-${line.key}`}
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
              line.treatment === "added" ? "text-action" : "text-ink-muted",
            )}
          >
            {source}
          </span>
          {line.detail === null ? null : (
            <span className="text-xs leading-close text-ink-secondary">· {line.detail}</span>
          )}
          {line.addedScope === null ? null : (
            <span className="text-xs leading-close text-ink-secondary">
              · {line.addedScope}
            </span>
          )}
        </div>
      </div>
      <Chip tone={TONE[line.treatment]} size="micro" bordered className="shrink-0">
        {TREATMENT_LABEL[line.treatment]}
      </Chip>
    </li>
  );
}
