import type { Field } from "@titlepipe/contract";
import { enginesDisagree, hasNoProvenance, naChip, rowMark } from "./fieldLabel";
import { fieldLabel } from "./fieldLabel";
import { NoValue } from "../../entities/field/NoValue";
import { Chip } from "../../shared/ui/Chip";
import { ListRow } from "../../shared/ui/ListRow";
import { cn } from "../../shared/ui/classNames";

/**
 * One field in the list.
 *
 * "NOT AVAILABLE" IS WHAT SHIPS; THE CHIP IS WHAT SEPARATES THE FOUR REASONS
 * (`review.spec` #1). Both are on the row because the reviewer needs to see the
 * report's text and the reason behind it at the same time — that pairing is
 * what makes a wrong NA reason visible before it leaves the building.
 *
 * A PENDING FIELD IS NEITHER (§0.3). It renders "not yet extracted" and never
 * "Not Available", because the pipeline has not looked yet — saying the value
 * is unavailable would be reporting a conclusion nobody reached.
 *
 * THE ROW IS THE BUTTON, so the row carries no padding of its own (`p-0` over
 * `ListRow`'s measured step). Padding on the `li` would turn the gutter into
 * dead space that looks clickable and is not, and would leave the selected tint
 * stopping short of the row edge. `ListRow` is here for the hairline and its
 * `first:` exemption — the triple this file used to spell by hand.
 */
export function FieldRow({
  field,
  selected,
  onSelect,
}: {
  field: Field;
  selected: boolean;
  onSelect: () => void;
}) {
  const mark = rowMark(field);
  const queued = field.state === "needs_review";

  return (
    <ListRow className="p-0">
      <button
        type="button"
        data-testid={`row-${field.path}`}
        aria-current={selected}
        onClick={onSelect}
        className={cn(
          "flex w-full flex-wrap items-baseline gap-4 px-6 py-4 text-left",
          selected && "bg-surface-sunken",
          queued && "border-l-2 border-l-state-attend",
        )}
      >
        <span className="w-56 font-mono text-xs text-ink-secondary">
          {fieldLabel(field.path)}
        </span>

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
    </ListRow>
  );
}
