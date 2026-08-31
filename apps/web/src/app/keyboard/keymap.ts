import { REVIEW_CHORDS } from "./reviewChords";

/**
 * The key registry — one row per chord, and it is the row that gets
 * installed. A key may not be printed in the shortcuts overlay unless
 * something binds it: `action` is the join for `global` rows (`GlobalKeys`
 * maps every action to a handler and installs the `chord`), while `review`
 * rows are the workstation's and carry no action — `keymap.test.ts` proves
 * those are really bound. Adding a row to either half puts it in the
 * overlay; nothing else has to be edited.
 */

/** What a chord does. The overlay never names an action with no handler. */
export type ChordAction = "open-palette" | "toggle-key-map" | "pop-layer";

/** Sentence case. Sections are the design's grouping, not new facts. */
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
     * `/` opens the palette app-wide — a deliberate divergence from focusing
     * one screen's search box, which would leave the key dead on every other
     * screen. The cap and the description say what the handler does.
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
