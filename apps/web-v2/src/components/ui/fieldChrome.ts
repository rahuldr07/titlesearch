/**
 * THE SHARED FIELD GEOMETRY.
 *
 * `controlClass` and `labelClass` sit here rather than beside `Input` for a
 * mechanical reason worth stating: `react-refresh/only-export-components` fires
 * on a module that exports both a component and a constant, and it is right to
 * — Fast Refresh cannot hot-swap a file whose non-component export something
 * else has already captured, so the edit silently full-reloads instead.
 *
 * The split has a design justification too, which is why it is not just
 * lint-appeasement: Input, TextArea, Select's trigger and ComboBox's group all
 * stand on this one box. Owning it from the module that happens to define
 * `Input` would make the other three look like they were borrowing.
 */

/** The 10px control box (rule 5), shared by every text-entry surface. */
export const controlClass = [
  "tp-state tp-target w-full rounded-md border border-control-border bg-control-fill",
  "px-8 py-6 font-sans text-body leading-close text-ink-primary",
  "placeholder:text-ink-muted",
  "focus:border-action focus:outline-2 focus:outline-offset-0 focus:outline-action",
  "disabled:bg-surface-sunken disabled:text-ink-disabled disabled:cursor-not-allowed",
];

/** 13px sentence-case label. Rule 3: sans, never mono. */
export const labelClass = "font-sans text-meta leading-close font-medium text-ink-secondary";

/** The option list shared by Select and ComboBox, so the two cannot drift. */
export const listBoxClass = "flex flex-col gap-1 p-3 outline-none";
