import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { Radio as BaseRadio } from "@base-ui/react/radio";
import type { ReactNode } from "react";
import { cn } from "./classNames";

/**
 * Same square geometry as Checkbox, circular. The distinction is not
 * decorative: a checkbox is "any of these", a radio is "exactly one of these",
 * and the design uses the radio for the cite-vs-draft choice on escalation
 * resolution — where picking both is meaningless and picking neither is a
 * refusal the server enforces.
 *
 * Note Base UI's `RadioGroup` has no `.Root`; the group element IS the export.
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

export function RadioGroup({
  value,
  defaultValue,
  onValueChange,
  disabled,
  className,
  children,
  ...rest
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: unknown) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
} & AccessibleName) {
  return (
    <BaseRadioGroup
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      className={cn("flex flex-col gap-4", className)}
      {...rest}
    >
      {children}
    </BaseRadioGroup>
  );
}

export function Radio({
  value,
  disabled,
  children,
}: {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-5 text-base">
      <BaseRadio.Root
        value={value}
        disabled={disabled}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-full",
          "border border-line-strong bg-surface-panel",
          "data-checked:border-action",
          "disabled:cursor-not-allowed disabled:bg-surface-app",
        )}
      >
        <BaseRadio.Indicator className="size-5 rounded-full bg-action data-unchecked:hidden" />
      </BaseRadio.Root>
      <span>{children}</span>
    </label>
  );
}
