/**
 * THE DESIGN'S SPLIT BAND, STATED ONCE.
 *
 * Design README §7: "split pane (drag divider, 38–74%)". Rule 11 — numbers
 * reconcile across screens, one variable and never two literals — so the band
 * lives here and both the component's callers and `resizable.a11y.stories.tsx`
 * (which measures that Home/End land on it) read the same two names.
 *
 * SEPARATE FROM `resizable.tsx` for the mechanical reason `field-chrome.ts`
 * records: `react-refresh/only-export-components` fires on a module exporting
 * both a component and a constant, and it is right to — Fast Refresh cannot
 * hot-swap a file whose non-component export something else has captured, so
 * the edit silently full-reloads instead.
 *
 * These are PERCENTAGES OF THE SPACE AVAILABLE TO PANELS — the group minus its
 * separators — not of the group. The distinction is not pedantry: it is what
 * made the first version of the band assertion measure 71.2 and expect 74.
 */

/** The decision column's floor. Narrower and a 28px value has nowhere to go. */
export const DECISION_MIN = "38%";

/** Its ceiling. Wider and the evidence pane cannot hold a citation box. */
export const DECISION_MAX = "74%";
