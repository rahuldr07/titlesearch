import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { cva, type VariantProps } from "class-variance-authority";
import { cx } from "./cx";
import { disabledAttributes, type Disablement } from "./disabled";

/**
 * RULE 1 IS THE WHOLE VARIANT SET. "Spend the accent once per screen: the open
 * decision or the single primary action. Everything else graphite."
 *
 * So `primary` is the accent fill and it is the ONE variant a screen may use
 * once. `secondary`, `quiet` and `danger` are graphite or halt and carry no
 * fill. There is deliberately no `accent-outline`, no `ghost-accent` and no
 * `link-primary`: every one of those is a second way to spend the accent, and
 * a rule that can be routed around is not a rule.
 *
 * The once-per-screen count is NOT enforced here — a primitive cannot see its
 * siblings. It is enforced by `e2e/invariants` counting accent fills per route,
 * which is the only layer that can. Stated because an unenforceable rule
 * silently believed to be enforced is the failure mode this repo has already
 * had.
 */
const button = cva(
  [
    "tp-state tp-target tp-ring inline-flex items-center justify-center gap-4",
    // Rule 3: buttons are NEVER mono. Rule 4: sentence case, so no `uppercase`.
    "font-sans text-meta leading-flat font-semibold whitespace-nowrap",
    // Rule 5: 10px is the control radius, one step in from a 14px surface.
    "rounded-md border cursor-pointer",
    "disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        /** The accent. Once per screen. */
        primary: [
          "bg-action text-ink-on-action border-action",
          "hover:not-disabled:bg-action-hover hover:not-disabled:border-action-hover",
          "disabled:bg-ink-disabled disabled:border-ink-disabled disabled:text-surface-panel",
        ],
        /** The default. Graphite on panel, hairline rule. */
        secondary: [
          "bg-surface-panel text-ink-primary border-control-border",
          "hover:not-disabled:bg-surface-sunken",
          "disabled:text-ink-disabled disabled:bg-control-fill",
        ],
        /** No chrome until hovered. Toolbars, row actions, dismissals. */
        quiet: [
          "bg-transparent text-ink-secondary border-transparent",
          "hover:not-disabled:bg-surface-sunken hover:not-disabled:text-ink-primary",
          "disabled:text-ink-disabled",
        ],
        /**
         * Halt, drawn as an outline rather than a fill — the accent is the only
         * solid fill in this palette (tokens.css header) and a red button that
         * outweighs the primary one inverts the screen's hierarchy.
         */
        danger: [
          "bg-surface-panel text-state-halt border-state-halt-border",
          "hover:not-disabled:bg-state-halt-surface",
          "disabled:text-ink-disabled disabled:border-control-border",
        ],
      },
      size: {
        /*
         * Heights read as `N x 2px` — the app's spacing base (ui.css). `h-13`
         * is 26px, not 13. Row actions and chips; still clears §2.5.8's 24px.
         */
        sm: "h-13 px-8",
        md: "h-16 px-10",
        lg: "h-20 px-12 text-body",
      },
      /** A square icon-only button. Needs `aria-label`; react-aria warns without. */
      icon: { true: "px-0 aspect-square", false: "" },
    },
    defaultVariants: { variant: "secondary", size: "md", icon: false },
  },
);

export type ButtonProps = Omit<AriaButtonProps, "isDisabled" | "className"> &
  Disablement &
  VariantProps<typeof button> & { readonly className?: string | undefined };

/**
 * `isDisabled` is Omit-ed, so the only way to disable a button in this app is
 * to say why. See `disabled.ts` — that omission is the enforcement.
 */
export function Button({
  variant,
  size,
  icon,
  className,
  disabledBecause,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      {...disabledAttributes(disabledBecause)}
      className={cx(button({ variant, size, icon }), className)}
    />
  );
}
