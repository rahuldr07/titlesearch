/**
 * THE OVERLAY SURFACE, DECLARED ONCE, AND THE CHORD MARK THAT RIDES WITH IT.
 *
 * Every anchored panel in this kit — Popover, Select's list, ComboBox's list,
 * the command palette — is the same surface: white, a `--color-line-strong`
 * hairline, radius 14 (rule 5's surface rung), card shadow, capped height.
 * Declared here rather than repeated so a change to the recipe is one edit
 * and so no component invents a fifth radius on the way past.
 *
 * ══ WHY THE SCOPE MARK IS NOT IN THIS STRING ════════════════════════════════
 *
 * `data-chord-scope` is an ATTRIBUTE, not a class, and the two values mean
 * different things (`focusRoles.ts` is emphatic about it):
 *
 *   own    = AN OVERLAY IS UP. Read document-wide by `overlayIsUp()`, so it
 *            suspends every chord everywhere while the node exists. Correct
 *            for a popover, a dialog and the palette — things that come and
 *            go. Fatal on anything permanently mounted.
 *   widget = THIS SUBTREE OWNS ITS KEYS WHILE FOCUSED. Read only against the
 *            active element's ancestors. Correct for Tabs, Table and
 *            ToggleGroup, which are on screen at all times.
 *
 * A Tabs strip marked `own` would make `overlayIsUp()` answer true forever and
 * kill every chord in the app permanently. So the constants are named for the
 * question they answer, and each component states which one it is and why.
 */

/** The panel every anchored overlay stands on. Radius 14 = rule 5's surface. */
export const overlaySurface =
  "tp-enter rounded-lg border border-line-strong bg-surface-panel shadow-card";

/**
 * The height cap. VERIFIED against react-aria 1.20 in the previous kit: a
 * popover exposes exactly two custom properties, `--trigger-width` and
 * `--trigger-anchor-point`, and NO max-height variable — so this is a spacing
 * value (`max-h-160` = 320px on the 2px base) rather than a var that resolves
 * to nothing and silently uncaps the panel.
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
 * A collection item — option, menu item, combobox row.
 *
 * Selection is drawn with a ✓ MARK plus weight (rule 6's glyph vocabulary),
 * never with colour alone, which fails a greyscale read. Radius 6 = rule 5's
 * inner rung, correct inside the 10px list padding of a 14px panel.
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

/*
 * ══ THE RECIPE'S HEADER INK IS `ink-muted`, NOT `ink-faint`, AND THAT IS A
 *    DELIBERATE DEVIATION FROM RECIPES.md ══════════════════════════════════
 *
 * RECIPES.md §Card specifies the header row as "11px w700 `#8A8E98`" —
 * `--color-ink-faint`. MEASURED, not assumed: #8a8e98 on the header's own
 * `--color-control-fill` (#fbfbfd) is 3.17:1. WCAG AA wants 4.5:1 for small
 * text, and the large-text exemption does not reach it — that needs 18.66px
 * bold, and this is 11px. The a11y gate is set to `error` in `.storybook/
 * preview.ts`, so it FAILED, which is how this was found rather than shipped.
 *
 * `--color-ink-muted` (#6e7480) is the next tier up and measures 4.54:1 on the
 * same fill. It is one step darker, it keeps the header receding below the
 * body ink, and it passes. The token file's own header measures the ink tiers
 * "on panel" and never claims ink-faint clears AA anywhere.
 *
 * This is a REPORTED deviation, not a silent one: the visual spec and WCAG
 * disagree, and an internal tool for examiners reading scans all day does not
 * get to lose that argument. `card.stories.tsx` fails the same way on the same
 * value, so the resolution belongs in the design system, not in one file.
 */

/**
 * The card recipe's header BAND. Not a card: nested cards are forbidden
 * (RECIPES.md §Card), so this has no border box, no radius and no shadow —
 * a hairline-ruled row on `--color-control-fill`, and the ink above.
 */
export const headerBand = "border-b border-line-subtle bg-control-fill";

/** The header's type: 11px w700, sentence case (rule 4 — no `uppercase`). */
export const headerType = "font-sans text-label leading-flat font-bold text-ink-muted";
