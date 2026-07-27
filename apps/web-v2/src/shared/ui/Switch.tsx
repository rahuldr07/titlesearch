import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "./classNames";

/**
 * The toggle. Three instances in the design, all identical geometry:
 * a 42x24 track with a 20px knob inset 2px, so the travel is exactly 18px.
 *
 * On the 2px spacing grid those are w-21 / h-12 / size-10 / translate-x-9 —
 * every dimension lands on the grid, which is a good sign the grid is right.
 *
 * Base UI drives state through data attributes rather than props, so the
 * checked appearance is expressed as `data-checked:` utilities. That keeps the
 * component declarative and means the DOM carries the state for tests and for
 * assistive tech, instead of it living only in a React closure.
 *
 * The track has no border and no transition — both absent from the design.
 */
export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Required: a switch with no accessible name is unusable without sight. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  id?: string;
}

export function Switch({ ...rest }: SwitchProps) {
  return (
    <BaseSwitch.Root
      className={cn(
        "relative inline-flex w-21 h-12 shrink-0 rounded-pill",
        "bg-line-strong data-checked:bg-action",
        "disabled:cursor-not-allowed disabled:bg-surface-app",
      )}
      {...rest}
    >
      <BaseSwitch.Thumb
        className={cn(
          "absolute top-1 left-1 size-10 rounded-full",
          "bg-surface-panel shadow-knob",
          "data-checked:translate-x-9",
        )}
      />
    </BaseSwitch.Root>
  );
}
