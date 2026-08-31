/**
 * Who owns this keystroke — the focused element, or the global chord layer?
 * React Aria puts DOM focus on the ITEMS (option, row, tab, …), not on the
 * containers, so the two lists use different mechanisms: item roles are
 * matched on the active element itself, container roles with `closest()` —
 * a focused option is inside a listbox, never equal to one.
 * `focusOwnership.test.ts` pins every role in both tables, DOM-free.
 */

import {
  FOCUSED_ITEM_ROLES,
  FOCUS_CONTAINER_SELECTOR,
  SCOPE_SELECTOR,
} from "./focusRoles";

export { FOCUSED_ITEM_ROLES };

/**
 * The three members this function reads — declared structurally rather than
 * as `Element` so the test can pin every role without a browser or a cast.
 * A real `Element` satisfies it.
 */
export type FocusTarget = Pick<Element, "tagName" | "getAttribute" | "closest">;


/**
 * Is a text surface or composite widget holding focus?
 * Four tests, cheapest first, each covering what the one before it cannot:
 * tagName for real inputs, contentEditable for rich text, the item role
 * table for what react-aria actually focuses, and `closest()` over container
 * roles plus `data-chord-scope` as the extension point.
 */
export function focusOwnsKeys(active: FocusTarget | null): boolean {
  if (active === null) return false;

  const tag = active.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (isContentEditable(active)) return true;

  const role = active.getAttribute("role");
  if (role !== null && FOCUSED_ITEM_ROLES.has(role)) return true;

  return active.closest(`${FOCUS_CONTAINER_SELECTOR},${SCOPE_SELECTOR}`) !== null;
}

/**
 * Duck-typed rather than `instanceof HTMLElement`: `instanceof` is
 * realm-bound (an element inside an iframe silently fails it), and the
 * global constructor would make this unrunnable in the DOM-free test.
 */
function isContentEditable(active: FocusTarget): boolean {
  const editable: unknown = (active as { isContentEditable?: unknown }).isContentEditable;
  return editable === true;
}
