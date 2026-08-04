import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { cn } from "./classNames";

/**
 * Geometry is taken from the tri-state mark button in the baseline grid — the
 * one square control the design actually draws: 22px, 4px radius, 1px
 * structural border, and on-state as a fill swap to the tone plus white glyph.
 * Reusing it keeps every square control in the app the same size instead of
 * inventing a second one.
 *
 * `indeterminate` is supported because a partially-satisfied group is a real
 * state here (a client override that narrows rather than waives), and the
 * alternative — showing it as unchecked — would misreport it.
 */
/**
 * At most one of `aria-label` / `aria-labelledby` — the same discriminated
 * union `Select` uses. A control with no accessible name is unusable without
 * sight, and modelling the pair as two optional props both allowed neither and
 * pushed the component over §6's prop ceiling.
 */
type AccessibleName =
  // Neither is permitted: a form control can take its name from an associated
  // `<label htmlFor>`, which no type can verify. axe catches a genuinely
  // unlabelled control on the Storybook run, which is the right layer for it.
  | { "aria-label"?: undefined; "aria-labelledby"?: undefined }
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never };

/** The half without the accessible name; `CheckboxProps` is the public one. */
interface CheckboxBaseProps {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  required?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  id?: string;
}

export type CheckboxProps = CheckboxBaseProps & AccessibleName;

export function Checkbox({ ...rest }: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-3",
        "border border-line-strong bg-surface-panel",
        "data-checked:border-action data-checked:bg-action",
        "data-indeterminate:border-action data-indeterminate:bg-action",
        "disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-surface-app",
      )}
      {...rest}
    >
      <BaseCheckbox.Indicator
        className="flex text-ink-on-action data-unchecked:hidden"
        render={(props, state) => (
          <span {...props}>
            <span aria-hidden className="text-sm font-bold leading-flat">
              {state.indeterminate ? "–" : "✓"}
            </span>
          </span>
        )}
      />
    </BaseCheckbox.Root>
  );
}
