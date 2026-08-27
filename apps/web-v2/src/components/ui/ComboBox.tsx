import type { ReactNode } from "react";
import {
  ComboBox as AriaComboBox,
  Input as AriaInput,
  Button as AriaButton,
  Group,
  type ComboBoxProps as AriaComboBoxProps,
} from "react-aria-components";
import { ChevronDown } from "lucide-react";
import { cx } from "./cx";
import { FieldShell, controlClass, type FieldShellProps } from "./Input";
import { Popover } from "./Popover";
import { ListBox, listBoxClass } from "./Option";
import { disabledAttributes } from "./disabled";

/**
 * A COMBOBOX: type to filter, or open the list.
 *
 * Same chord contract as Select — the popover subtree marks itself, so the
 * global vocabulary stands down. A ComboBox is the WORST case for that bug and
 * the reason `focusOwnsKeys` tests role as well as tag: focus is on an `INPUT`
 * (which the prototype's guard does catch) but the LISTBOX below it is a
 * `<div role="listbox">` (which it does not), so the two halves of the widget
 * were guarded inconsistently.
 *
 * `allowsEmptyCollection` is left at react-aria's default (false): a filtered
 * list with no matches CLOSES rather than showing an empty panel. An empty
 * panel over a search field is a state a reviewer reads as "still loading".
 * A caller that wants an in-popover empty state passes `EmptyState` as a
 * child and turns this on itself.
 */
export type ComboBoxProps = Omit<
  AriaComboBoxProps<object>,
  "isDisabled" | "className" | "children"
> &
  FieldShellProps & {
    readonly children: ReactNode;
    readonly placeholder?: string | undefined;
  };

export function ComboBox({
  label,
  labelHidden,
  description,
  errorMessage,
  disabledBecause,
  placeholder,
  children,
  ...props
}: ComboBoxProps) {
  const shell = { label, labelHidden, description, errorMessage, disabledBecause };
  return (
    <AriaComboBox
      {...props}
      {...disabledAttributes(disabledBecause)}
      isInvalid={errorMessage !== undefined}
      className="flex flex-col gap-3"
    >
      <FieldShell {...shell}>
        {/*
         * The Group is the visual box; the Input inside it is transparent and
         * unbordered. Two borders (one on the group, one on the input) is the
         * standard combobox mistake and shows up as a 1px double rule that
         * nobody can find in the styles.
         */}
        <Group
          className={cx(
            controlClass,
            "flex items-center gap-4 p-0 focus-within:border-action focus-within:outline-2 focus-within:outline-action",
          )}
        >
          <AriaInput
            {...(placeholder === undefined ? {} : { placeholder })}
            className="min-w-0 flex-1 bg-transparent px-8 py-6 font-sans text-body leading-close text-ink-primary outline-none placeholder:text-ink-muted"
          />
          <AriaButton
            aria-label="Show suggestions"
            className="tp-state tp-target tp-ring flex cursor-pointer items-center justify-center rounded-sm px-4 text-ink-muted hover:text-ink-primary"
          >
            <ChevronDown aria-hidden size={16} />
          </AriaButton>
        </Group>
      </FieldShell>
      <Popover>
        <ListBox className={listBoxClass}>{children}</ListBox>
      </Popover>
    </AriaComboBox>
  );
}
