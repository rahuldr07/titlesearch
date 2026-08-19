import { Select as BaseSelect } from "@base-ui/react/select";
import type { ReactNode } from "react";
import { cn } from "./classNames";

/**
 * The design uses ONE native `<select>`, unstyled, with no custom chevron. A
 * native select cannot be styled consistently across platforms and cannot show
 * the rule-citation text these menus need, so this is a real listbox.
 *
 * The trigger deliberately matches TextField's geometry exactly — same border,
 * radius and padding — because in the design a select sits in the same form
 * rows as text inputs and any difference reads as an accident.
 *
 * The popup borrows the menu's treatment, which is the design's one drawn
 * floating surface.
 */
export function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  children,
  ...rest
}: {
  value?: unknown;
  defaultValue?: unknown;
  onValueChange?: (value: unknown) => void;
  disabled?: boolean;
  children: ReactNode;
  name?: string;
}) {
  return (
    <BaseSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      {...rest}
    >
      {children}
    </BaseSelect.Root>
  );
}

/**
 * An accessible name is REQUIRED, not optional — pass either `aria-labelledby`
 * pointing at the visible label (preferred: sighted and non-sighted users then
 * get the same words) or `aria-label`.
 *
 * The trigger renders as `role="combobox"`, and a combobox whose only content
 * is placeholder text has no accessible name at all. Caught by axe on the
 * Storybook run: "Buttons must have discernible text". Making the prop
 * mandatory in the type is what stops that recurring at every call site.
 */
type AccessibleName =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never };

export function SelectTrigger({
  placeholder = "Select…",
  className,
  ...name
}: { placeholder?: ReactNode; className?: string } & AccessibleName) {
  return (
    <BaseSelect.Trigger
      className={cn(
        "flex w-full items-center justify-between gap-4",
        "rounded-6 border border-line-strong bg-surface-panel px-5 py-4",
        "text-base text-ink-primary",
        "data-placeholder:text-ink-muted",
        "disabled:cursor-not-allowed disabled:bg-surface-app disabled:text-ink-muted",
        className,
      )}
      {...name}
    >
      {/* `placeholder` is SelectValue's own prop; passing a children function
          instead silently overrides it and leaves the trigger empty. */}
      <BaseSelect.Value placeholder={placeholder} />
      <BaseSelect.Icon aria-hidden className="text-ink-muted">
        ▾
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

export function SelectPopup({ children }: { children: ReactNode }) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={4} className="z-(--z-popup)">
        <BaseSelect.Popup className="max-h-160 w-(--anchor-width) overflow-auto rounded-9 border border-line-strong bg-surface-panel p-3 shadow-menu">
          {children}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

export function SelectItem({
  value,
  disabled,
  children,
}: {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <BaseSelect.Item
      value={value}
      disabled={disabled}
      className={cn(
        "flex cursor-default items-center gap-4 rounded-5 px-5 py-4 text-base",
        "text-ink-primary data-highlighted:bg-surface-app",
        "data-selected:font-semibold data-selected:text-action",
        "data-disabled:text-ink-muted",
      )}
    >
      <BaseSelect.ItemIndicator aria-hidden className="w-5 text-action">
        ✓
      </BaseSelect.ItemIndicator>
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}
