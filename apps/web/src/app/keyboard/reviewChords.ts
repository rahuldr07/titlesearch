import type { ChordSpec } from "./keymap";

/**
 * THE WORKSTATION'S SIX KEYS, IN THE REGISTRY BUT NOT ON THE WINDOW.
 *
 * INVARIANT 50 makes keys pane-local — "the innermost layer that can use a key
 * wins" — so `features/review/useReviewKeys.ts` installs these, not
 * `GlobalKeys`. That is why every row here carries `install: "review"` and a
 * null `action`: there is no global handler to join, and `GlobalKeys` skips
 * them by construction rather than by remembering to.
 *
 * They are listed anyway, because the alternative was worse. The shortcut
 * overlay printed only the four global chords while the workstation bound six
 * more and `WorkstationBar` printed all six as chips — a cheat sheet that omits
 * the keys a reader is most likely to press is lying by omission, which is the
 * same rule-11 failure as advertising a key nothing binds, run backwards.
 *
 * `keymap.test.ts` is what keeps the claim true: it reads `useReviewKeys.ts`
 * and fails if these six and the keys that file binds are not the same set.
 *
 * DOUBLE-CLICK IS NOT HERE. The design's list ends with "Double-Click · enter
 * rapid inline editing" and nothing in the app binds `dblclick` to the
 * correction editor. Rule 11 refuses it: this registry lists installed keys.
 */
export const REVIEW_CHORDS: readonly ChordSpec[] = [
  {
    id: "review-confirm",
    chord: "c",
    cap: "C",
    /*
     * "machine read" rather than "value": ORPHAN O9 — the chord never accepts a
     * blank, so a field the server sent no value for is not confirmable by key
     * (`DecisionPanel.tsx`). Described by what it does.
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
     * What the handler DOES, not what the design drew: `Z` toggles the source
     * page between fit and 200% (`ScanPane.tsx` — the reference's animated
     * zoom-to-bbox was deliberately simplified, and the note there records
     * it). Rule 11 backwards: a cap describing a behaviour nothing performs
     * is the same lie as a key nothing binds.
     */
    desc: "Toggle the source page between fit and 200% magnification",
    action: null,
    install: "review",
    alwaysOn: false,
    section: "In the review workstation",
  },
];
