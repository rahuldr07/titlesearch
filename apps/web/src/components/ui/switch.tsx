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
 * ADAPTED FROM THE REGISTRY `switch`, AND THE SIZES WENT WITH THE `dark:`s.
 *
 * The registry ships `h-[18.4px] w-[32px]` and `h-[14px] w-[24px]` — five
 * arbitrary values, one of them a fractional pixel, and the rules gate bans all
 * of them. There is now ONE size: 20x36 on the 2px base (`h-10 w-18`), with a
 * 16px thumb and 2px of inset. A control this small does not have a meaningful
 * second size; it has a second size because a registry has to guess.
 *
 * `translate-x-[calc(100%-2px)]` is likewise gone: the travel is
 * `translate-x-8` (16px), which is track minus thumb minus both insets, and
 * that arithmetic is stated here rather than deferred to a calc the reader
 * cannot check.
 *
 * ══ WHEN NOT TO USE THIS ═════════════════════════════════════════════════════
 *
 * A switch commits IMMEDIATELY and has no confirm step. Nothing that changes
 * the record — a disposition, a release, a countersign — may be a switch. Those
 * are decisions and decisions get a button and a sentence. This is for view
 * preferences: show retired rules, follow the cursor into the scan.
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
