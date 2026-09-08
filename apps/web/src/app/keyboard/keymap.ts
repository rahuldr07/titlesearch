import { REVIEW_CHORDS } from "./reviewChords";
import type { ChordSection, ChordSpec } from "./chordSpec";

/**
 * The key registry — one row per chord, and it is the row that gets
 * installed. A key may not be printed in the shortcuts overlay unless
 * something binds it: `action` is the join for `global` rows (`GlobalKeys`
 * maps every action to a handler and installs the `chord`), while `review`
 * rows are the workstation's and carry no action — `keymap.test.ts` proves
 * those are really bound. Adding a row to either half puts it in the
 * overlay; nothing else has to be edited.
 */

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
