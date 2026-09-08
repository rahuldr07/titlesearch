/**
 * The split band, stated once — callers and the a11y stories read the same
 * two names. Separate from resizable.tsx because Fast Refresh cannot
 * hot-swap a module exporting both a component and a constant. These are
 * percentages of the space available to panels — the group minus its
 * separators — not of the group.
 */

/** The decision column's floor. Narrower and a 28px value has nowhere to go. */
export const DECISION_MIN = "38%";

/** Its ceiling. Wider and the evidence pane cannot hold a citation box. */
export const DECISION_MAX = "74%";
