/**
 * The shared field geometry — Input, Textarea, InputGroup and Select's
 * trigger all stand on this one box. Kept apart from the components because
 * Fast Refresh cannot hot-swap a module exporting both a component and a
 * constant.
 */

/**
 * Height is deliberately absent — a textarea grows, and a fixed height in
 * the shared box would fight that.
 */
export const controlClass = [
  "tp-state tp-target w-full min-w-0",
  "rounded-md border border-control-border bg-control-fill",
  "px-6 py-4 font-sans text-meta leading-close text-ink-primary",
  "placeholder:text-ink-muted outline-none",
  "focus-visible:border-action focus-visible:outline-2 focus-visible:outline-offset-0",
  "focus-visible:outline-action",
  "aria-invalid:border-state-halt aria-invalid:outline-state-halt",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-disabled",
  "disabled:border-line-strong",
  // A file picker is still a control; it gets the kit's chrome, not the
  // browser's default button.
  "file:inline-flex file:h-14 file:border-0 file:bg-transparent",
  "file:font-sans file:text-meta file:font-semibold file:text-ink-primary",
]

/** 36px, at ui.css's 2px base. */
export const controlHeight = "h-18"

/**
 * 11px w700 grey, sentence case, above the control. Deliberately ink-muted
 * rather than the spec's ink-faint: ink-faint measures ~3.2:1, below WCAG
 * 1.4.3's 4.5:1 for 11px text (the large-text exemption starts at 18.66px
 * bold). Residual: ink-muted is 4.04:1 on the bare app canvas — a form label
 * belongs on a card, and one on the canvas will fail axe by design.
 */
export const labelClass = [
  "flex items-center gap-3 select-none",
  "font-sans text-label leading-close font-bold text-ink-muted",
]

/** Standing help and refusal wording. 13px, one tier in from the value. */
export const descriptionClass =
  "font-sans text-meta leading-close font-normal text-ink-secondary"

/** The server's field-level refusal. Halt ink, never a filled red box. */
export const errorClass = "font-sans text-meta leading-close font-normal text-state-halt"
