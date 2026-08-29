"use client";

import * as React from "react";
import {
  Label as LabelPrimitive,
  ProgressBar as ProgressPrimitive,
  type LabelProps,
  type ProgressBarProps as ProgressPrimitiveProps,
} from "react-aria-components";

import { cx } from "./cx";

/**
 * THE BAR, RETOKENISED — AND IT IS NOT THE ONE THE SCREENS USE.
 *
 * `progress-meter.tsx` draws the 18-dot meter the design specifies for decision
 * settlement. This file is the bar, for the case a bar genuinely fits: a
 * CONTINUOUS, UNCOUNTABLE quantity where "about three quarters" is the true
 * statement — an upload's bytes, an OCR pass over 900 pages. Reach for it only
 * when you could not say what one dot would mean.
 *
 * Adaptation: `bg-muted` → `bg-line-strong`; `bg-primary` → `bg-state-settled`
 * (rule 1 — the accent is spent on the screen's open decision, never on a
 * progress fill); `h-1` → `h-2` (4px on the 2px base); the size and value
 * readouts onto the six-size scale, the readout in mono since a count is data
 * (rule 3); `transition-all` → `tp-move`, because a fill that travels is
 * movement (300ms). The indicator's width is the one inline style in this kit
 * and is not avoidable: no class set can encode a continuous value.
 */
type ProgressContextValue = {
  percentage?: number | undefined;
  isIndeterminate: boolean;
  valueText?: string | undefined;
};

const ProgressContext = React.createContext<ProgressContextValue | null>(null);

function useProgress() {
  const context = React.useContext(ProgressContext);
  if (!context) throw new Error("useProgress must be used within a Progress.");
  return context;
}


function ProgressContent({
  children,
  percentage,
  isIndeterminate,
  valueText,
}: ProgressContextValue & { children?: React.ReactNode }) {
  const context = React.useMemo(
    () => ({ percentage, isIndeterminate, valueText }),
    [percentage, isIndeterminate, valueText],
  );

  return (
    <ProgressContext value={context}>
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressContext>
  );
}

function Progress({
  className,
  children,
  ...props
}: Omit<ProgressPrimitiveProps, "children" | "className"> & {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <ProgressPrimitive
      data-slot="progress"
      className={cx("flex flex-wrap gap-4", className)}
      {...props}
    >
      {({ percentage, valueText, isIndeterminate }) => (
        <ProgressContent
          percentage={percentage}
          valueText={valueText}
          isIndeterminate={isIndeterminate}
        >
          {children}
        </ProgressContent>
      )}
    </ProgressPrimitive>
  );
}

function ProgressTrack({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="progress-track"
      className={cx(
        "relative flex h-2 w-full items-center overflow-x-hidden rounded-pill bg-line-strong",
        className,
      )}
      {...props}
    />
  );
}

function ProgressIndicator({ className, ...props }: React.ComponentProps<"span">) {
  const { percentage, isIndeterminate } = useProgress();
  const width = `${isIndeterminate ? 100 : (percentage ?? 0)}%`;

  return (
    <span
      data-slot="progress-indicator"
      className={cx("tp-move h-full bg-state-settled", className)}
      style={{ width }} /* rules-allow: a continuous percentage has no class form — see header */
      {...props}
    />
  );
}

function ProgressLabel({ className, ...props }: LabelProps) {
  return (
    <LabelPrimitive
      data-slot="progress-label"
      className={cx("font-sans text-meta leading-close font-semibold text-ink-primary", className)}
      {...props}
    />
  );
}

function ProgressValue({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  children?: (value: string) => React.ReactNode;
}) {
  const { valueText } = useProgress();
  return (
    <span
      data-slot="progress-value"
      className={cx("ml-auto font-mono text-meta leading-close text-ink-secondary", className)}
      {...props}
    >
      {children && valueText != null ? children(valueText) : valueText}
    </span>
  );
}

export { Progress, ProgressTrack, ProgressIndicator, ProgressLabel, ProgressValue };
