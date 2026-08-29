import { REVIEW_CHORDS } from "./reviewChords";

/**
 * THE KEY REGISTRY — one row per chord, and it is the row that gets INSTALLED.
 *
 * Before this file the vocabulary was written twice: `GlobalKeys.tsx` bound
 * `$mod+k` / `?` / `/` / `Escape`, and the `?` overlay printed its own literal
 * arrays next door. Rule 11 — one variable, never two literals — and the
 * failure mode is specific: the overlay advertised C/E/Q/J/K/Z as review keys
 * and nothing in the app bound them. A cheat sheet that names keys that do not
 * fire is worse than no cheat sheet.
 *
 * So `action` is the join. `GlobalKeys` maps every action to a handler and
 * installs the `chord`; the shortcuts overlay renders the `cap` and the `desc`
 * off the same rows.
 *
 * ══ TWO INSTALLERS, ONE LIST ═══════════════════════════════════════════════
 *
 * `install` says which layer binds the row. `global` rows are `GlobalKeys`',
 * joined by `action`. `review` rows are the workstation's (INVARIANT 50: keys
 * are pane-local) and carry no action — `reviewChords.ts` argues why, and
 * `keymap.test.ts` proves the six are really bound. Adding a row to either half
 * puts it in the overlay; nothing else has to be edited, and nothing may be
 * listed that no layer installs.
 */

/** What a chord does. The overlay never names an action with no handler. */
export type ChordAction = "open-palette" | "toggle-key-map" | "pop-layer";

/** Sentence case (rule 4). Sections are the design's grouping, not new facts. */
export type ChordSection =
  | "In the review workstation"
  | "Moving around"
  | "Leaving a layer";

export interface ChordSpec {
  readonly id: string;
  /** The `tinykeys` pattern actually installed. */
  readonly chord: string;
  /** The cap the overlay prints. Key NAMES, passed through — `Kbd` casing. */
  readonly cap: string;
  readonly desc: string;
  /** The join to `GlobalKeys`' handlers. Null when a screen installs the row. */
  readonly action: ChordAction | null;
  /** Which layer binds it: the window, or the review workstation's own panes. */
  readonly install: "global" | "review";
  /**
   * Escape alone opts out of chord suppression: it is how you LEAVE a text
   * surface or an overlay, so it must fire from inside both (`chords.ts`).
   */
  readonly alwaysOn: boolean;
  readonly section: ChordSection;
}

const GLOBAL_CHORDS: readonly ChordSpec[] = [
  {
    id: "palette-mod-k",
    chord: "$mod+k",
    cap: "⌘K / Ctrl K",
    desc: "Open the command palette",
    action: "open-palette",
    install: "global",
    alwaysOn: false,
    section: "Moving around",
  },
  {
    /*
     * The design binds `/` to the All Orders search box (`ref-orders.html`
     * @3338). That screen and its search box now exist — the browse endpoint
     * was authorised by `RULING-2026-08-28.md` option C — so the old note here
     * ("there is no search surface") is no longer true and has been removed.
     *
     * The binding still opens the PALETTE, app-wide, and that is a deliberate
     * divergence written up in `CONFLICT-slash-key.md`: a global `/` that
     * focuses a box existing on one screen is dead on the other eleven, and
     * `chord-suppression.spec` #5 rests on `/` being palette-owned. The cap and
     * the description say what the handler does, which is rule 11's other half.
     */
    id: "palette-slash",
    chord: "/",
    cap: "/",
    desc: "Open the command palette",
    action: "open-palette",
    install: "global",
    alwaysOn: false,
    section: "Moving around",
  },
  {
    id: "shortcuts",
    chord: "?",
    cap: "?",
    desc: "Toggle this shortcut list",
    action: "toggle-key-map",
    install: "global",
    alwaysOn: false,
    section: "Moving around",
  },
  {
    id: "pop-layer",
    chord: "Escape",
    cap: "Esc",
    desc: "Close the innermost layer, one at a time",
    action: "pop-layer",
    install: "global",
    alwaysOn: true,
    section: "Leaving a layer",
  },
];

export const KEYMAP: readonly ChordSpec[] = [...REVIEW_CHORDS, ...GLOBAL_CHORDS];

/** Render order. A section with no rows is not drawn. */
export const CHORD_SECTIONS: readonly ChordSection[] = [
  "In the review workstation",
  "Moving around",
  "Leaving a layer",
];

export function chordsIn(section: ChordSection): readonly ChordSpec[] {
  return KEYMAP.filter((spec) => spec.section === section);
}
