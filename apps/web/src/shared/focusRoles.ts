/**
 * The role tables. Data, not logic — see `focusOwnership.ts` for what reads
 * them and for the REVIEW-01 B3 finding that made them what they are.
 * Separated so the tables can be read, and diffed, as tables. Every entry is a
 * claim about what react-aria emits, and a claim that can be checked against
 * its source is worth keeping away from the branching that consumes it.
 */

/**
 * Roles that RECEIVE focus and own every printable key while they have it.
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
 * Never by equality: focus is on the item, so the container is an ancestor of
 * the active element, never the active element. `listbox` and `menu` were on
 * the old list and could not fire for exactly this reason.
 */
export const FOCUS_CONTAINER_SELECTOR =
  "[role='listbox'],[role='menu'],[role='menubar'],[role='grid'],[role='treegrid'],[role='tree'],[role='radiogroup'],[role='tablist']";

/**
 * The two scope markers, and why they are not one.
 * `data-chord-scope="own"` means AN OVERLAY IS UP. `chords.ts:overlayIsUp`
 * reads it document-wide, so it suspends every chord everywhere while any
 * element carrying it exists. That is right for a dialog, a popover, the
 * command palette and the key map. Those are the only four that set it.
 * `data-chord-scope="widget"` means THIS SUBTREE OWNS ITS KEYS WHILE FOCUSED.
 * It is read only here, only against the active element's ancestors, and it
 * never suspends anything globally.
 * The distinction is load-bearing and was nearly a bug while fixing B3: a Tabs
 * strip or a Checkbox marked `own` is present in the document at all times, so
 * `overlayIsUp()` would answer true forever and EVERY chord in the app would
 * be permanently dead. S6 asks for these composites to be scope-marked; they
 * are, with the value that means what is intended.
 */
export const SCOPE_SELECTOR = "[data-chord-scope='own'],[data-chord-scope='widget']";
