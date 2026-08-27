import type { ReactNode } from "react";
import {
  Select as AriaSelect,
  SelectValue,
  Button as AriaButton,
  type SelectProps as AriaSelectProps,
} from "react-aria-components";
import { ChevronDown } from "lucide-react";
import { cx } from "./cx";
import { FieldShell, controlClass, type FieldShellProps } from "./Input";
import { Popover } from "./Popover";
import { ListBox, listBoxClass } from "./Option";
import { disabledAttributes } from "./disabled";

/**
 * A SELECT, WHICH IS A COMPOSITE, WHICH MEANS IT OWNS ITS KEYS.
 *
 * The popover subtree carries `data-chord-scope="own"` — set once, on
 * `Popover` — so `shared/chords.ts` stands the global single-key vocabulary
 * down while this is open. Without it, `q` inside an open Select would both
 * typeahead to "Quarantine" and fire the global escalate chord on the field
 * behind it. That is the exact bug `chords.ts` was written to prevent and the
 * exact reason composites route through one popover component here.
 *
 * `<ChevronDown />` is the ONE icon in this component and rule 7 is why: "no
 * icon soup". A disclosure arrow is structural affordance rather than
 * decoration — it says the control opens — and nothing else in the kit reaches
 * for lucide without that justification.
 */
export type SelectProps = Omit<
  AriaSelectProps<object>,
  "isDisabled" | "className" | "children"
> &
  FieldShellProps & {
    /** `Option` elements, or a Collection render over them. */
    readonly children: ReactNode;
    readonly placeholder?: string | undefined;
  };

export function Select({
  label,
  labelHidden,
  description,
  errorMessage,
  disabledBecause,
  placeholder = "Select…",
  children,
  ...props
}: SelectProps) {
  const shell = { label, labelHidden, description, errorMessage, disabledBecause };
  return (
    <AriaSelect
      {...props}
      {...disabledAttributes(disabledBecause)}
      isInvalid={errorMessage !== undefined}
      className="flex flex-col gap-3"
    >
      <FieldShell {...shell}>
        <AriaButton
          className={cx(
            controlClass,
            "tp-ring flex cursor-pointer items-center justify-between gap-4 text-left",
          )}
        >
          <SelectValue className="truncate data-placeholder:text-ink-muted" />
          <ChevronDown aria-hidden size={16} className="shrink-0 text-ink-muted" />
        </AriaButton>
      </FieldShell>
      <Popover>
        <ListBox className={listBoxClass}>{children}</ListBox>
      </Popover>
    </AriaSelect>
  );
}
