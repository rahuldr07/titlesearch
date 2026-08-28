/**
 * Who owns this keystroke — the focused element, or the global chord layer?
 * Split out of `chords.ts` because it is the part with a table in it, and the
 * table is the part that was wrong.
 * WHAT REVIEW-01 (B3) FOUND. The previous list checked CONTAINER roles —
 * listbox, menu, grid, tree. React Aria puts DOM focus on the ITEMS, so nine
 * of nine roles it actually focuses walked straight past:
 *   option            useOption.mjs:44          ListBox / Select / ComboBox items
 *   row               useGridListItem.mjs:274   GridList / Table rows
 *   tab               useTab.mjs:60             Tabs
 *   menuitemradio     useMenuItem role= variant
 *   menuitemcheckbox  useMenuItem role= variant
 *   radio             RadioGroup
 *   checkbox          Checkbox
 *   switch            Switch
 *   slider            Slider
 * `gridcell` was on the list and `row` was not, while `useGridListItem`
 * defaults to `focusMode: 'row'`. This is INVARIANT 51's ORPHAN rule O15 — the
 * rule with no other record in the repo, so nothing else would have caught it.
 * THE TWO HALVES OF THE FIX, and they are different mechanisms:
 *   1. ITEM roles are matched on the ACTIVE ELEMENT. These are the things that
 *      actually hold focus.
 *   2. CONTAINER roles are matched with `closest()`, not by equality. That is
 *      what the container list was presumably always meant to do: a focused
 *      `option` is INSIDE a `listbox`, so asking "is the active element a
 *      listbox" answers no every time. Asking "is it inside one" answers yes.
 * Belt and braces on purpose. `focusOwnership.test.ts` pins every role in both
 * tables, DOM-free, in the `gates` Vitest project — the executable check the
 * chord header used to claim and not have.
 */

import {
  FOCUSED_ITEM_ROLES,
  FOCUS_CONTAINER_SELECTOR,
  SCOPE_SELECTOR,
} from "./focusRoles";

export { FOCUSED_ITEM_ROLES };

/**
 * The three members this function reads, and the whole of its input contract.
 * Declared structurally rather than as `Element` because that is what is
 * true: nothing here needs a real DOM node, and saying so lets
 * `focusOwnership.test.ts` pin every role without a browser and without an
 * `as unknown as` cast to smuggle a fake past the compiler. A real `Element`
 * satisfies it, so every call site is unchanged.
 */
export type FocusTarget = Pick<Element, "tagName" | "getAttribute" | "closest">;


/**
 * Is a text surface or composite widget holding focus?
 * Four tests, cheapest first, and each covers what the one before it cannot:
 *   1. tagName — the reference prototype's test, correct as far as it goes and
 *      the only one that catches a real `<input>`.
 *   2. contentEditable — a rich text surface that is not an INPUT.
 *   3. the ITEM role table — what react-aria actually focuses.
 *   4. `closest()` over container roles and `data-chord-scope="own"` — the
 *      extension point, for composites this function cannot know about.
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
 * Duck-typed rather than `active instanceof HTMLElement && …`.
 * Two reasons, and the second is the one that bites. `instanceof` is
 * REALM-BOUND: an element focused inside an iframe belongs to that document's
 * HTMLElement, not this one, so the check silently answers false and the
 * global layer acts on a keystroke typed into an embedded editor. And the
 * reference to the global constructor makes this function unrunnable outside a
 * browser — which is how `focusOwnership.test.ts` found it, since that test is
 * deliberately DOM-free so the rule can be checked without a browser at all.
 */
function isContentEditable(active: FocusTarget): boolean {
  const editable: unknown = (active as { isContentEditable?: unknown }).isContentEditable;
  return editable === true;
}
