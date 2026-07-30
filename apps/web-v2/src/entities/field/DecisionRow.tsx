import type { Field } from "@titlepipe/contract";
import { enginesDisagree, fieldLabel, hasNoProvenance, naChip, rowMark } from "./fieldLabel";
import { NoValue } from "./NoValue";
import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";

const DOT: Record<string, string> = {
  needs_review: "bg-state-attend",
  escalated: "bg-state-attend",
  corrected: "bg-action",
  confirmed: "bg-state-settled",
  auto_confirmed: "bg-state-settled",
  pending: "bg-line-strong",
};

/**
 * One field in the queue, collapsed.
 *
 * THE WHOLE ROW IS THE BUTTON — not an `<li>` holding one. The export's queue
 * row is a bare `<button>` spanning the card, and the shape is the point: a row
 * that IS a control is reached in one Tab, and its click target is the same
 * rectangle a mouse user already aims at. A row wrapping a smaller control
 * leaves a gutter that looks clickable and is not, and costs a keyboard user an
 * extra stop per field on a list of twenty-one.
 *
 * The cost, stated: nothing inside may be a second control. The page cite is
 * therefore plain text here rather than `PageChip`, because a button inside a
 * button is invalid HTML that screen readers announce unpredictably. On the
 * sheet, where the row is not a control, `FieldValue` uses the real chip.
 *
 * "NOT AVAILABLE" IS WHAT SHIPS; THE CHIP IS WHAT SEPARATES THE FOUR REASONS
 * (`review.spec` #1). Both are on the row because the reviewer needs the
 * report's text and the reason behind it at the same time — that pairing is
 * what makes a wrong NA reason visible before it leaves the building.
 *
 * A PENDING FIELD IS NEITHER. It renders "not yet extracted" and never "Not
 * Available", because the pipeline has not looked yet: saying the value is
 * unavailable would report a conclusion nobody reached.
 *
 * THE MARK IS PRESENT ONLY FOR STATES A HUMAN PUT THE FIELD INTO. An
 * auto-confirmed field carries none, because marking it would make the screen
 * unable to answer the question a complaint investigation always asks: did a
 * person see this?
 */
export function DecisionRow({
  field,
  onActivate,
  selected = false,
}: {
  field: Field;
  onActivate: () => void;
  selected?: boolean;
}) {
  const mark = rowMark(field);

  return (
    <button
      type="button"
      data-testid={`row-${field.path}`}
      aria-current={selected}
      onClick={onActivate}
      className={cn(
        "flex w-full flex-wrap items-baseline gap-4 border-t border-line-subtle px-6 py-4 text-left first:border-t-0",
        "hover:bg-row-hover",
        selected && "bg-surface-sunken",
      )}
    >
      <span aria-hidden className={cn("size-4 self-center rounded-pill", DOT[field.state])} />

      <span className="w-56 font-mono text-xs text-ink-secondary">{fieldLabel(field.path)}</span>

      <span className="flex-1">
        {field.value !== null ? (
          <span className="font-mono text-base text-ink-primary">{field.value}</span>
        ) : field.na_reason !== null ? (
          <span className="font-mono text-base text-ink-secondary">Not Available</span>
        ) : (
          <NoValue value={{ kind: enginesDisagree(field) ? "unsettled" : "pending" }} />
        )}
      </span>

      {field.na_reason !== null ? (
        <Chip
          tone={field.na_reason === "PRESENT_UNREADABLE" ? "halt" : "neutral"}
          size="micro"
          bordered
        >
          {naChip(field.na_reason)}
        </Chip>
      ) : null}

      {enginesDisagree(field) ? (
        <Chip tone="attend" size="micro" bordered>
          A≠B
        </Chip>
      ) : null}

      {hasNoProvenance(field) ? (
        <Chip tone="halt" size="micro" bordered>
          NO PROVENANCE
        </Chip>
      ) : null}

      {mark === null ? null : (
        <span data-testid="row-mark" className="text-xs font-semibold text-state-settled-ink">
          {mark}
        </span>
      )}
    </button>
  );
}
