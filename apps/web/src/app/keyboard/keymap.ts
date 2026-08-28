/**
 * THE KEY REGISTRY — one row per chord, and it is the row that gets INSTALLED.
 *
 * Before this file the vocabulary was written twice: `GlobalKeys.tsx` bound
 * `$mod+k` / `?` / `/` / `Escape`, and the `?` overlay printed its own literal
 * arrays next door. Rule 11 — one variable, never two literals — and the
 * failure mode is specific: the overlay advertised C/E/Q/J/K/Z as review keys
 * and NOTHING IN THE APP BINDS THEM. A cheat sheet that names keys that do not
 * fire is worse than no cheat sheet.
 *
 * So `action` is the join. `GlobalKeys` maps every action to a handler and
 * installs the `chord`; the shortcuts overlay renders the `cap` and the `desc`
 * off the same rows. A shortcut cannot be advertised without being installed,
 * and cannot be installed without appearing in the list.
 */

/** What a chord does. The overlay never names an action with no handler. */
export type ChordAction = "open-palette" | "toggle-key-map" | "pop-layer";

/** Sentence case (rule 4). Sections are the design's grouping, not new facts. */
export type ChordSection = "Moving around" | "Leaving a layer";

export interface ChordSpec {
  readonly id: string;
  /** The `tinykeys` pattern actually installed by `GlobalKeys`. */
  readonly chord: string;
  /** The cap the overlay prints. Key NAMES, passed through — `Kbd` casing. */
  readonly cap: string;
  readonly desc: string;
  readonly action: ChordAction;
  /**
   * Escape alone opts out of chord suppression: it is how you LEAVE a text
   * surface or an overlay, so it must fire from inside both (`chords.ts`).
   */
  readonly alwaysOn: boolean;
  readonly section: ChordSection;
}

export const KEYMAP: readonly ChordSpec[] = [
  {
    id: "palette-mod-k",
    chord: "$mod+k",
    cap: "⌘K / Ctrl K",
    desc: "Open the command palette",
    action: "open-palette",
    alwaysOn: false,
    section: "Moving around",
  },
  {
    /*
     * The design says `/` "focuses search". There is no search surface — the
     * browsable order list it belongs to is a hard conflict (`GlobalKeys.tsx`),
     * so `/` opens the one search surface that exists. Described by what it
     * does, never by what the design wished it did.
     */
    id: "palette-slash",
    chord: "/",
    cap: "/",
    desc: "Open the command palette",
    action: "open-palette",
    alwaysOn: false,
    section: "Moving around",
  },
  {
    id: "shortcuts",
    chord: "?",
    cap: "?",
    desc: "Toggle this shortcut list",
    action: "toggle-key-map",
    alwaysOn: false,
    section: "Moving around",
  },
  {
    id: "pop-layer",
    chord: "Escape",
    cap: "Esc",
    desc: "Close the innermost layer, one at a time",
    action: "pop-layer",
    alwaysOn: true,
    section: "Leaving a layer",
  },
];

/** Render order. A section with no rows is not drawn. */
export const CHORD_SECTIONS: readonly ChordSection[] = [
  "Moving around",
  "Leaving a layer",
];

export function chordsIn(section: ChordSection): readonly ChordSpec[] {
  return KEYMAP.filter((spec) => spec.section === section);
}
