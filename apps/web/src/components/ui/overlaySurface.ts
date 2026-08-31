/**
 * The one surface every anchored panel stands on, plus the chord marks.
 *
 * The two `data-chord-scope` values mean different things:
 *   own    — an overlay is up. Read document-wide by overlayIsUp(), so it
 *            suspends every chord everywhere while the node exists. Correct
 *            for transient overlays; fatal on anything permanently mounted.
 *   widget — this subtree owns its keys while focused. Read only against
 *            the active element's ancestors. Correct for Tabs, Table,
 *            SegmentedControl.
 * A Tabs strip marked `own` would kill every chord in the app permanently.
 */

/** The panel every anchored overlay stands on. Radius 14 — the surface rung. */
export const overlaySurface =
  "tp-enter rounded-lg border border-line-strong bg-surface-panel shadow-card";

/**
 * The height cap. react-aria popovers expose no max-height custom property,
 * so this is a spacing value (max-h-160 = 320px on the 2px base) rather than
 * a var that resolves to nothing and silently uncaps the panel.
 */
export const overlayCap = "max-h-160 overflow-auto";

/**
 * An overlay that is UP. Suspends the global vocabulary document-wide.
 * Spread onto the outermost node of a transient overlay.
 */
export const chordOverlay = { "data-chord-scope": "own" } as const;

/**
 * A composite that OWNS ITS KEYS WHILE FOCUSED. Never suspends anything
 * globally. Spread onto a permanently-mounted collection container.
 */
export const chordWidget = { "data-chord-scope": "widget" } as const;

/**
 * A collection item — option, menu item, combobox row. Selection is a ✓ mark
 * plus weight, never colour alone. Radius 6: the inner rung, correct inside
 * the 10px list padding of a 14px panel.
 */
export const collectionItem = [
  "tp-state tp-target flex cursor-pointer items-center gap-4 rounded-sm px-6 py-4",
  "font-sans text-body leading-close text-ink-primary outline-none",
  // react-aria's own attribute: keyboard focus OR pointer hover inside a
  // collection, which is the behaviour a menu wants and `:hover` is not.
  "data-focused:bg-surface-sunken",
  "data-selected:font-semibold",
  "data-disabled:cursor-not-allowed data-disabled:text-ink-disabled",
].join(" ");

/** The ✓ gutter. Fixed width so labels align whether or not a row is picked. */
export const markGutter = "w-8 shrink-0 text-ink-muted";

/**
 * The header band. Not a card — nested cards are forbidden, so no border
 * box, radius or shadow of its own. The ink is deliberately ink-muted, not
 * the spec's ink-faint: ink-faint measures 3.17:1 at 11px bold on
 * control-fill, below AA's 4.5:1.
 */
export const headerBand = "border-b border-line-subtle bg-control-fill";

/** The header's type: 11px w700, sentence case. */
export const headerType = "font-sans text-label leading-flat font-bold text-ink-muted";
