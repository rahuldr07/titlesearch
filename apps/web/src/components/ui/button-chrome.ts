import { cva } from "class-variance-authority"

/**
 * Button variant table. --spacing is 2px, so heights read as N × 2px (h-19 is
 * 38px). There is deliberately no `invalid` variant: invalid is a field state
 * (field.tsx), and a red button would compete with the actual refusal.
 */
const buttonVariants = cva(
  [
    "group/button tp-state tp-press tp-target tp-ring",
    "inline-flex shrink-0 items-center justify-center gap-4 whitespace-nowrap",
    "font-sans leading-flat font-semibold text-meta",
    // Surface radius: a 38px button is a surface rather than an input.
    "rounded-lg border bg-clip-padding cursor-pointer outline-none select-none",
    "disabled:cursor-not-allowed disabled:pointer-events-auto",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** The accent. At most one per screen. */
        primary: [
          "bg-action text-ink-on-action border-action",
          "hover:not-disabled:bg-action-hover hover:not-disabled:border-action-hover",
          "disabled:bg-line-strong disabled:border-line-strong disabled:text-ink-faint",
        ],
        /** The default. White + control border. */
        secondary: [
          "bg-surface-panel text-ink-primary border-control-border",
          "hover:not-disabled:bg-surface-sunken",
          "aria-expanded:bg-surface-sunken",
          "disabled:bg-line-strong disabled:border-line-strong disabled:text-ink-faint",
        ],
        /** Borderless, ink-secondary w500. Toolbars, row actions, dismissals. */
        ghost: [
          "bg-transparent text-ink-secondary border-transparent font-medium",
          "hover:not-disabled:bg-surface-sunken hover:not-disabled:text-ink-primary",
          "aria-expanded:bg-surface-sunken aria-expanded:text-ink-primary",
          "disabled:text-ink-faint",
        ],
        /**
         * Halt, as an outline — the accent is the only solid fill, so
         * quarantine/withdraw must not read as the primary action.
         */
        halt: [
          "bg-surface-panel text-state-halt border-state-halt-border",
          "hover:not-disabled:bg-state-halt-surface",
          "disabled:bg-line-strong disabled:border-line-strong disabled:text-ink-faint",
        ],
      },
      size: {
        /** 30px. Row actions and chips; still clears WCAG §2.5.8's 24px. */
        sm: "h-15 px-8",
        /** 38px — the standard height. */
        md: "h-19 px-12",
        /** 44px, for the one action a decision screen leads with. */
        lg: "h-22 px-14 text-body",
      },
      /** Square, icon-only. Needs `aria-label`; react-aria warns without one. */
      icon: { true: "px-0 aspect-square", false: "" },
    },
    defaultVariants: { variant: "secondary", size: "md", icon: false },
  }
)

export { buttonVariants }
