"use client";

import {
  composeRenderProps,
  Switch as SwitchPrimitive,
  type SwitchProps as SwitchPrimitiveProps,
} from "react-aria-components";

import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";
import { BlockedHint } from "./blockedHint";

/**
 * One size: 20×36 on the 2px base, 16px thumb, 2px inset — the travel of
 * `translate-x-8` is track minus thumb minus both insets.
 *
 * A switch commits immediately and has no confirm step. Nothing that changes
 * the record — a disposition, a release, a countersign — may be a switch;
 * those get a button and a sentence. This is for view preferences only.
 */
export type SwitchProps = Omit<SwitchPrimitiveProps, "isDisabled"> & Disablement;

function Switch({ className, children, disabledBecause, ...props }: SwitchProps) {
  return (
    <BlockedHint reason={disabledBecause}>
      <SwitchPrimitive
        data-slot="switch"
        {...props}
        {...disabledAttributes(disabledBecause)}
        className={cx(
          "tp-state tp-ring group/switch relative inline-flex shrink-0 cursor-pointer items-center gap-4",
          "font-sans text-meta leading-close text-ink-primary",
          "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
          className,
        )}
      >
        {composeRenderProps(children, (children, { isSelected }) => (
          <>
            <span
              data-slot="switch-track"
              aria-hidden
              className={cx(
                "tp-state relative inline-flex h-10 w-18 shrink-0 items-center rounded-pill border p-1",
                "after:absolute after:-inset-x-3 after:-inset-y-2",
                isSelected
                  ? "border-action bg-action"
                  : "border-control-border bg-line-strong",
                "group-data-disabled/switch:border-line-strong group-data-disabled/switch:bg-surface-sunken",
              )}
            >
              <span
                data-slot="switch-thumb"
                className={cx(
                  "tp-move block size-8 rounded-pill bg-surface-panel shadow-card",
                  isSelected ? "translate-x-8" : "translate-x-0",
                )}
              />
            </span>
            {children}
          </>
        ))}
      </SwitchPrimitive>
    </BlockedHint>
  );
}

export { Switch };
