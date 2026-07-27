import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import type { ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The pill filter — 16 instances. Client chips, product chips, role chips,
 * audit filters, rule-tag filters.
 *
 * These are RADIOS, not buttons. The design renders them as a `<button>` soup
 * (`component-inventory.md` §4.5), which means a keyboard user tabs through
 * every option one at a time and gets no signal that they form a set. A toggle
 * group gives arrow-key navigation within the group and a single tab stop,
 * which is what a set of mutually exclusive choices should behave like.
 *
 * Pressed is a fill swap to action + white — the same selection language the
 * design uses for tabs, option cards and the page strip. Consistency here is
 * load-bearing: a reviewer learns "violet fill means chosen" once.
 */
export function ToggleGroup({
  value,
  defaultValue,
  onValueChange,
  multiple = false,
  className,
  children,
  ...rest
}: {
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (value: readonly string[]) => void;
  /** false = radio semantics (pick one), true = checkbox semantics. */
  multiple?: boolean;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <BaseToggleGroup
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      multiple={multiple}
      className={cn("flex flex-wrap gap-3", className)}
      {...rest}
    >
      {children}
    </BaseToggleGroup>
  );
}

export function Toggle({
  value,
  disabled,
  className,
  children,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <BaseToggle
      value={value}
      disabled={disabled}
      className={cn(
        "rounded-pill border px-5 py-3 text-xs font-semibold whitespace-nowrap",
        "border-line-strong bg-surface-panel text-ink-secondary",
        "data-pressed:border-action data-pressed:bg-action data-pressed:text-ink-on-action",
        "disabled:cursor-not-allowed disabled:bg-surface-app disabled:text-ink-muted",
        className,
      )}
    >
      {children}
    </BaseToggle>
  );
}
