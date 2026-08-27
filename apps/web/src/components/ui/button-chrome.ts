import { cva } from "class-variance-authority"

/**
 * ADAPTED FROM THE ARIA REGISTRY. What changed, and why:
 *
 *   - SIX variants became FOUR. `link` is deleted (a button that is a link is
 *     a link), and `destructive` became `halt` drawn as an OUTLINE: the accent
 *     is the only solid fill in this palette (tokens.css header), so a filled
 *     red button would outrank the one primary action rule 1 allows.
 *   - `h-8` / `rounded-lg` became 38px / radius 14 (RECIPES §Buttons). Heights
 *     read as `N x 2px` — ui.css sets --spacing to 2px, so `h-19` is 38px.
 *   - Every `dark:` variant is gone. There is no dark register; dark is CHROME.
 *   - `disabled:opacity-50` became an explicit disabled RENDERING plus a
 *     reason: `disabledBecause` (disabled.ts), which is rule 9 as a type.
 *   - `cn` became `cx` — stock tailwind-merge reads `text-meta` as a COLOUR and
 *     silently deletes `text-ink-on-action`. See cx.ts.
 *
 * There is deliberately no `invalid` variant. Invalid is a FIELD state — the
 * control gets the halt border and the message gets halt ink (field.tsx). A
 * button that turned red because the form was wrong would be a second red
 * signal competing with the actual refusal.
 */
const buttonVariants = cva(
  [
    "group/button tp-state tp-press tp-target tp-ring",
    "inline-flex shrink-0 items-center justify-center gap-4 whitespace-nowrap",
    // Rule 3: buttons are never mono. Rule 4: sentence case, so no uppercase.
    "font-sans leading-flat font-semibold text-meta",
    // RECIPES: radius 14. Rule 5's surface radius, because a 38px button is a
    // surface rather than an input.
    "rounded-lg border bg-clip-padding cursor-pointer outline-none select-none",
    "disabled:cursor-not-allowed disabled:pointer-events-auto",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** The accent (#5B4B8A). Rule 1: at most ONE per screen. */
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
         * Halt, as an OUTLINE. Kept over deleting it because quarantine and
         * withdraw are real actions that must not read as the primary one.
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
        /** 38px — the RECIPES height. */
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
