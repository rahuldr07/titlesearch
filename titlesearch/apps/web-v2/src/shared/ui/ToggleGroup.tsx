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
      className={cn("flex flex-wrap gap-4", className)}
      {...rest}
    >
      {children}
    </BaseToggleGroup>
  );
}

/**
 * SELECTION IS AN INK INVERSION, NOT THE ACCENT.
 *
 * RULE: the sealing wax is spent once per screen, on the one action. FAILURE
 * PREVENTED: filled in the accent, a row of filter chips put four wax objects
 * on a screen whose actual press — "Take next order" — is one. The chosen chip
 * then outranked the decision, which is the failure QueueViewToggle already had
 * to route around by hand. The mockup fills the chosen chip in INK
 * (`.pchip.on`) and gives it the card shadow; the accent never appears in a
 * filter row. Ink also inverts with the theme — `bg-ink-primary` /
 * `text-surface-panel` measures 15.8:1 light and 8.7:1 mocha — so one pair of
 * tokens carries both.
 *
 * The shadow is on the PRESSED state only. Unpressed chips stay flat so a
 * segmented track (QueueViewToggle) does not gain a raised chip in every slot;
 * the mockup's `.toggle button.on` lifts for exactly the same reason.
 *
 * Three other selection surfaces — `Tabs`, `ChoiceCardGrid`, `PageStrip` —
 * still fill in the accent. They are outside this task's files and want the
 * same treatment.
 */
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
        "rounded-5 border px-5.5 py-3 text-xs font-semibold whitespace-nowrap",
        "border-line-strong bg-surface-panel text-ink-secondary",
        "data-pressed:border-ink-primary data-pressed:bg-ink-primary",
        "data-pressed:text-surface-panel data-pressed:shadow-card",
        "disabled:cursor-not-allowed disabled:bg-surface-app disabled:text-ink-muted",
        "disabled:shadow-none",
        className,
      )}
    >
      {children}
    </BaseToggle>
  );
}
