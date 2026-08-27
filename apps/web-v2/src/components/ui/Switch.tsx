import type { ReactNode } from "react";
import { Switch as AriaSwitch, type SwitchProps as AriaSwitchProps } from "react-aria-components";
import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";

/**
 * A SWITCH IS FOR A SETTING THAT TAKES EFFECT IMMEDIATELY.
 *
 * That is the whole distinction from Checkbox and it is worth stating because
 * getting it wrong is invisible: a checkbox proposes a value that a Save
 * commits, a switch IS the commit. The manifest include/omit toggles on the
 * release compiler (design §Screens 8) are switches; a quarantine checklist is
 * not.
 *
 * MOTION: the thumb travels on `tp-move` (300ms, the movement token), not on
 * `tp-state tp-press`. It is the only control in this kit whose geometry animates, and
 * rule 10's third timing exists for exactly this. Nothing bounces — the curve
 * ends at rest.
 *
 * The track is 36x20 and the label carries `tp-target`, so §2.5.8's 24px floor
 * is met by the hit area rather than by inflating the drawn control.
 */
export type SwitchProps = Omit<AriaSwitchProps, "isDisabled" | "className" | "children"> &
  Disablement & { readonly children: ReactNode };

export function Switch({ disabledBecause, children, ...props }: SwitchProps) {
  return (
    <AriaSwitch
      data-chord-scope="widget"
      {...props}
      {...disabledAttributes(disabledBecause)}
      className={cx(
        "tp-target tp-ring group flex cursor-pointer items-center gap-6 rounded-sm py-2",
        "font-sans text-body leading-close text-ink-primary",
        "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "tp-state flex h-10 w-18 shrink-0 items-center rounded-pill border p-1",
          "border-control-border bg-control-fill",
          "group-data-selected:border-action group-data-selected:bg-action",
          "group-data-disabled:border-ink-disabled group-data-disabled:bg-surface-sunken",
          "group-data-selected:group-data-disabled:bg-ink-disabled",
        )}
      >
        <span className="tp-move size-8 translate-x-0 rounded-pill bg-surface-panel shadow-card group-data-selected:translate-x-8" />
      </span>
      {children}
    </AriaSwitch>
  );
}
