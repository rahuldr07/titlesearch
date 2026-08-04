import type { ReactNode } from "react";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * One row of the assembled report: field name on the left, value on the right.
 *
 * THE ROW IS NOT A BUTTON, and that is a correction rather than a preference.
 * Making the whole row clickable nests `PageChip`'s button inside the row's
 * button — invalid HTML, which React warns about and screen readers announce
 * unpredictably. Caught by axe on the Storybook run.
 *
 * The right fix is not to strip the chip's button: the row and the chip are
 * TWO DIFFERENT INTENTS. "Select this field" and "show me page 3" are separate
 * actions that happen to sit near each other, and collapsing them into one
 * target was the actual mistake. So the FIELD NAME is the selecting control and
 * the chip keeps its own.
 *
 * The cost is the design's whole-row pointer target. That is a real loss for
 * mouse users and worth naming — but a `<div onClick>` wrapper would be
 * unreachable by keyboard, which §6 forbids outright, and nested buttons are
 * simply invalid. Two honest controls beat one broken one.
 *
 * SELECTION, NOT HOVER. There is no `:hover` rule on any table row anywhere in
 * the design — the active row is filled and that is the only row treatment.
 * A hover state would make every row the pointer crosses look momentarily
 * selected, on a screen where "which field am I deciding" is the whole question.
 *
 * The value is a slot: it renders `FieldValue`, `NoValue`, or a composition.
 * This row does not know which, and must not — deciding "has a value or not"
 * here would duplicate logic belonging to those two.
 */
export function FieldRow({
  label,
  children,
  selected = false,
  onSelect,
}: {
  /** The field's name, as the report prints it. */
  label: string;
  /** The rendered value — FieldValue, NoValue, or a composition. */
  children: ReactNode;
  selected?: boolean;
  /** Omitted when the field has no provenance to travel to. */
  onSelect?: (() => void) | undefined;
}) {
  return (
    <div
      // NO ARIA ROLE. `role="row"` was tried and rejected: it requires
      // `cell`/`gridcell` children, and declaring a role without its required
      // structure is worse than declaring none — axe fails it, and a screen
      // reader announces a malformed table. This is a field/value pair, not a
      // grid. Selection is announced by `aria-current` on the CONTROL below,
      // which is the thing a user actually operates.
      className={cn(
        "flex gap-7 border-t border-line-subtle px-8 py-5",
        selected && "bg-action-surface",
      )}
    >
      <div className="w-1/3 shrink-0 pt-1">
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            aria-current={selected ? "true" : undefined}
            className="text-left"
          >
            <Eyebrow variant="field" tone={selected ? "action" : "muted"}>
              {label}
            </Eyebrow>
          </button>
        ) : (
          <Eyebrow variant="field">{label}</Eyebrow>
        )}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
