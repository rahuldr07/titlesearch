/**
 * The role tables. Data, not logic — `focusOwnership.ts` reads them.
 * Separated so the tables can be read, and diffed, as tables. Every entry is
 * a claim about what react-aria emits.
 */

/**
 * Roles that receive focus and own every printable key while they have it.
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
  // Collection items — react-aria focuses the item, not the container.
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
 * Roles that contain a focused item. Matched with `closest()`, never by
 * equality: focus is on the item, so the container is an ancestor of the
 * active element, never the active element itself.
 */
export const FOCUS_CONTAINER_SELECTOR =
  "[role='listbox'],[role='menu'],[role='menubar'],[role='grid'],[role='treegrid'],[role='tree'],[role='radiogroup'],[role='tablist']";

/**
 * The two scope markers are not interchangeable. `data-chord-scope="own"`
 * means "an overlay is up": `chords.ts:overlayIsUp` reads it document-wide
 * and suspends every chord while any element carrying it exists — only the
 * overlays may set it. `data-chord-scope="widget"` means "this subtree owns
 * its keys while focused" and is read only against the active element's
 * ancestors. An always-present composite marked `own` would suspend every
 * chord in the app permanently.
 */
export const SCOPE_SELECTOR = "[data-chord-scope='own'],[data-chord-scope='widget']";
