import type { ReactNode } from "react";
import {
  RadioGroup as AriaRadioGroup,
  Radio as AriaRadio,
  Text,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
} from "react-aria-components";
import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";

/**
 * One radio. The mark is a • — rule 7's glyph for "this one", drawn as a filled
 * dot inside a ring rather than as an icon.
 *
 * `description` matters here more than on a checkbox: the reissue gateway
 * (design §Screens 9) is a radio list of REASONS, and a reason needs a sentence
 * under it. Putting that sentence in the label would make the accessible name
 * a paragraph.
 */
export type RadioProps = Omit<AriaRadioProps, "isDisabled" | "className" | "children"> &
  Disablement & {
    readonly children: ReactNode;
    readonly description?: string | undefined;
  };

export function Radio({ disabledBecause, description, children, ...props }: RadioProps) {
  return (
    <AriaRadio
      {...props}
      {...disabledAttributes(disabledBecause)}
      className={cx(
        "tp-target tp-ring group flex cursor-pointer items-start gap-5 rounded-sm py-2",
        "font-sans text-body leading-close text-ink-primary",
        "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "tp-state mt-1 flex size-8 shrink-0 items-center justify-center rounded-pill border",
          "border-control-border bg-control-fill",
          "group-data-selected:border-action",
          "group-data-disabled:border-ink-disabled group-data-disabled:bg-surface-sunken",
        )}
      >
        <span className="tp-state size-4 rounded-pill bg-transparent group-data-selected:bg-action group-data-selected:group-data-disabled:bg-ink-disabled" />
      </span>
      <span className="flex flex-col gap-1">
        <span>{children}</span>
        {description !== undefined && (
          <span className="font-sans text-meta leading-close text-ink-secondary">
            {description}
          </span>
        )}
      </span>
    </AriaRadio>
  );
}

export type RadioGroupProps = Omit<
  AriaRadioGroupProps,
  "isDisabled" | "className" | "children"
> &
  Disablement & {
    readonly label: string;
    readonly children: ReactNode;
  };

/**
 * The group owns the label and the reason; a single radio inside a blocked
 * group does not repeat it. Rule 9 is satisfied once, at the level the refusal
 * actually applies to.
 */
export function RadioGroup({ label, disabledBecause, children, ...props }: RadioGroupProps) {
  return (
    <AriaRadioGroup
      {...props}
      {...disabledAttributes(disabledBecause)}
      className="flex flex-col gap-4"
    >
      <span className="font-sans text-meta leading-close font-medium text-ink-secondary">
        {label}
      </span>
      {children}
      {typeof disabledBecause === "string" && disabledBecause.length > 0 && (
        <Text slot="description" className="font-sans text-meta leading-close text-ink-secondary">
          {disabledBecause}
        </Text>
      )}
    </AriaRadioGroup>
  );
}
