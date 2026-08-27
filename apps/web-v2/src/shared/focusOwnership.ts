/**
 * WHO OWNS THIS KEYSTROKE — THE FOCUSED ELEMENT, OR THE GLOBAL CHORD LAYER?
 *
 * Split out of `chords.ts` because it is the part with a table in it, and the
 * table is the part that was wrong.
 *
 * WHAT REVIEW-01 (B3) FOUND. The previous list checked the roles of
 * CONTAINERS — listbox, menu, grid, tree. React Aria puts DOM focus on the
 * ITEMS. Measured against the installed react-aria, nine of nine roles it
 * actually focuses walked straight past:
 *
 *   option            useOption.mjs:44          ListBox / Select / ComboBox items
 *   row               useGridListItem.mjs:274   GridList / Table rows
 *   tab               useTab.mjs:60             Tabs
 *   menuitemradio     useMenuItem role= variant
 *   menuitemcheckbox  useMenuItem role= variant
 *   radio             RadioGroup
 *   checkbox          Checkbox
 *   switch            Switch
 *   slider            Slider
 *
 * `gridcell` was on the list and `row` was not, while `useGridListItem`
 * defaults to `focusMode: 'row'`. `menuitem` was on it; its two role variants
 * were not. This is INVARIANT 51's ORPHAN rule O15 — "a chord's second key must
 * never ALSO fire a screen action. This is what stops a stray keystroke
 * destroying an in-progress correction" — and it is the rule with no other
 * record in the repo, so nothing else would have caught it.
 *
 * THE TWO HALVES OF THE FIX, and they are different mechanisms:
 *
 *   1. ITEM roles are matched on the ACTIVE ELEMENT. These are the things that
 *      actually hold focus.
 *   2. CONTAINER roles are matched with `closest()`, not by equality. That is
 *      what the container list was presumably always meant to do: a focused
 *      `option` is INSIDE a `listbox`, so asking "is the active element a
 *      listbox" answers no every time. Asking "is it inside one" answers yes.
 *
 * Belt and braces on purpose. Either half alone would cover most of the cases;
 * the review's finding was that one mechanism, opted into, is the mechanism
 * that fails.
 *
 * `src/shared/focusOwnership.test.ts` pins every role in both tables and runs
 * DOM-free in the `gates` Vitest project. It is the executable check the chord
 * header used to claim and not have.
 */

/**
 * Roles that RECEIVE focus and own every printable key while they have it.
 *
 * Typeahead is the reason for the collection items — a `<div role="option">`
 * consumes `q` as a search character, and the global layer must not also read
 * it as "quarantine". The single controls (radio/checkbox/switch/slider) are
 * here for a different reason: Space, Enter and the arrows are theirs, and a
 * chord layer that acts on them fights the control.
 */
export const FOCUSED_ITEM_ROLES: ReadonlySet<string> = new Set([
  // Text surfaces that are not <input>. react-aria renders these as divs.
  "textbox",
  "searchbox",
  "spinbutton",
  "combobox",
  // Collection items — the nine the review proved missing, plus the ones the
  // old list happened to have right.
  "option",
  "row",
  "gridcell",
  "columnheader",
  "rowheader",
  "tab",
  "treeitem",
  "menuitem",
  "menuitemradio",
  "menuitemcheckbox",
  // Single controls whose keys are their own.
  "radio",
  "checkbox",
  "switch",
  "slider",
]);

/**
 * Roles that CONTAIN a focused item. Matched with `closest()`.
 *
 * Never by equality: focus is on the item, so the container is an ancestor of
 * the active element, never the active element. `listbox` and `menu` were on
 * the old list and could not fire for exactly this reason.
 */
const FOCUS_CONTAINER_SELECTOR =
  "[role='listbox'],[role='menu'],[role='menubar'],[role='grid'],[role='treegrid'],[role='tree'],[role='radiogroup'],[role='tablist']";

/**
 * THE TWO SCOPE MARKERS, AND WHY THEY ARE NOT ONE.
 *
 * `data-chord-scope="own"` means AN OVERLAY IS UP. `chords.ts:overlayIsUp`
 * reads it document-wide, so it suspends every chord everywhere while any
 * element carrying it exists. That is right for a dialog, a popover, the
 * command palette and the key map. Those are the only four that set it.
 *
 * `data-chord-scope="widget"` means THIS SUBTREE OWNS ITS KEYS WHILE FOCUSED.
 * It is read only here, only against the active element's ancestors, and it
 * never suspends anything globally.
 *
 * The distinction is load-bearing and was nearly a bug while fixing B3: a Tabs
 * strip or a Checkbox marked `own` is present in the document at all times, so
 * `overlayIsUp()` would answer true forever and EVERY chord in the app would
 * be permanently dead. S6 asks for these composites to be scope-marked; they
 * are, with the value that means what is intended.
 */
const SCOPE_SELECTOR = "[data-chord-scope='own'],[data-chord-scope='widget']";

/**
 * Is a text surface or composite widget holding focus?
 *
 * Four tests, cheapest first, and each covers what the one before it cannot:
 *
 *   1. tagName — the reference prototype's test, correct as far as it goes and
 *      the only one that catches a real `<input>`.
 *   2. contentEditable — a rich text surface that is not an INPUT.
 *   3. the ITEM role table — what react-aria actually focuses.
 *   4. `closest()` over container roles and `data-chord-scope="own"` — the
 *      extension point, for composites this function cannot know about.
 */
export function focusOwnsKeys(active: Element | null): boolean {
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
 *
 * Two reasons, and the second is the one that bites. `instanceof` is
 * REALM-BOUND: an element focused inside an iframe belongs to that document's
 * HTMLElement, not this one, so the check silently answers false and the
 * global layer acts on a keystroke typed into an embedded editor. And the
 * reference to the global constructor makes this function unrunnable outside a
 * browser — which is how `focusOwnership.test.ts` found it, since that test is
 * deliberately DOM-free so the rule can be checked without a browser at all.
 */
function isContentEditable(active: Element): boolean {
  const editable: unknown = (active as { isContentEditable?: unknown }).isContentEditable;
  return editable === true;
}
