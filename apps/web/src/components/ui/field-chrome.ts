/**
 * THE SHARED FIELD GEOMETRY.
 *
 * These live here rather than beside `Input` for a mechanical reason worth
 * stating: `react-refresh/only-export-components` fires on a module exporting
 * both a component and a constant, and it is right to — Fast Refresh cannot
 * hot-swap a file whose non-component export something else has captured, so
 * the edit silently full-reloads instead.
 *
 * The split has a design justification too: Input, Textarea, InputGroup and
 * Select's trigger all stand on this one box. Owning it from the module that
 * happens to define `Input` would make the other three look like borrowers.
 */

/**
 * RECIPES §Inputs: radius 10, `--color-control-fill` on
 * `--color-control-border`, 13px. Height is deliberately absent — a textarea
 * grows, and a fixed height in the shared box would fight that.
 *
 * The registry's `text-base md:text-sm` pair is deleted: rule 2 allows six
 * sizes and a control that changes size at a breakpoint is a seventh.
 * `disabled:opacity-50` is replaced by an explicit disabled rendering, because
 * a half-transparent control over a hairline table reads as a rendering bug
 * rather than as a refusal.
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

/** 36px — the low end of the RECIPES 36–38px band, at ui.css's 2px base. */
export const controlHeight = "h-18"

/**
 * 11px w700 grey, sentence case, ABOVE the control (RECIPES §Inputs).
 *
 * THE RECIPE SAYS `#8A8E98` AND THIS IS `--color-ink-muted` INSTEAD, which is
 * a deliberate deviation with a measurement behind it. `--color-ink-faint`
 * (#8A8E98) is 3.28:1 on panel, 3.17:1 on sunken and 2.83:1 on the app canvas.
 * WCAG 1.4.3 wants 4.5:1 for 11px text, and the large-text exemption starts at
 * 18.66px bold — an 11px label does not reach it on any reading. The a11y gate
 * (preview.ts sets `a11y: { test: "error" }`) fails the story, and it is right
 * to: a label nobody can read is not a label.
 *
 * `--color-ink-muted` (#6E7480) is the nearest tier that clears it — 4.69:1 on
 * panel, 4.54:1 on sunken — and it is the value the recipe itself already uses
 * for read-only field text, so the register does not gain a new grey.
 *
 * Note the residual: 4.04:1 on `--color-surface-app`. A form label belongs on
 * a card, not on the canvas, so that is the correct constraint rather than a
 * hole — but a screen that puts one on the bare canvas will fail axe, and that
 * is the intended signal, not a bug in this token.
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
