import type { ChordSpec } from "./keymap";

/**
 * The workstation's six keys — in the registry but not on the window. Keys
 * are pane-local, so `features/review/useReviewKeys.ts` installs these, not
 * `GlobalKeys`; every row carries `install: "review"` and a null `action`,
 * so `GlobalKeys` skips them by construction. They are listed anyway: a
 * cheat sheet that omits the keys a reader is most likely to press lies by
 * omission. `keymap.test.ts` reads `useReviewKeys.ts` and fails if these and
 * the keys that file binds are not the same set. Double-click is not here —
 * this registry lists installed keys, and nothing binds it.
 */
export const REVIEW_CHORDS: readonly ChordSpec[] = [
  {
    id: "review-confirm",
    chord: "c",
    cap: "C",
    /*
     * "Machine read" rather than "value": the chord never accepts a blank,
     * so a field the server sent no value for is not confirmable by key.
     */
    desc: "Confirm the open field's machine read",
    action: null,
    install: "review",
    alwaysOn: false,
    section: "In the review workstation",
  },
  {
    id: "review-correct",
    chord: "e",
    cap: "E",
    desc: "Open the correction editor on the field",
    action: null,
    install: "review",
    alwaysOn: false,
    section: "In the review workstation",
  },
  {
    id: "review-escalate",
    chord: "q",
    cap: "Q",
    desc: "Escalate the field to QC",
    action: null,
    install: "review",
    alwaysOn: false,
    section: "In the review workstation",
  },
  {
    id: "review-next",
    chord: "j",
    cap: "J",
    desc: "Move to the next field",
    action: null,
    install: "review",
    alwaysOn: false,
    section: "In the review workstation",
  },
  {
    id: "review-previous",
    chord: "k",
    cap: "K",
    desc: "Move to the previous field",
    action: null,
    install: "review",
    alwaysOn: false,
    section: "In the review workstation",
  },
  {
    id: "review-zoom",
    chord: "z",
    cap: "Z",
    /*
     * Describes what the handler does: `ScanPane.tsx` scales the sheet to
     * the focused citation.
     */
    desc: "Zoom the evidence page to the focused citation",
    action: null,
    install: "review",
    alwaysOn: false,
    section: "In the review workstation",
  },
];
