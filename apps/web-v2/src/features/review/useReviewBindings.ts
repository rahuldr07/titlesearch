import type { Field } from "@titlepipe/contract";
import { offersExclude } from "./excludeGate";
import type { ReviewMode } from "./ReviewEditors";
import { useReviewKeys } from "./useReviewKeys";
import type { useReviewWrites } from "./useReviewWrites";

/**
 * The screen's decisions, bound to the key map — split from `ReviewScreen` so
 * the screen stays assembly (§5) and each rule below sits beside the binding
 * that enforces it.
 *
 * `c` NEVER ACCEPTS A BLANK (`ux.spec` O9). Confirm moved off ⏎ onto `c` in
 * the design remap; the rule moved with it. A missing field demands an
 * explicit click — the only keyboard-layer defence against bulk-accepting
 * absences by holding the confirm key down. The button (`act-confirm`) calls
 * `submitConfirm` directly, so the explicit click still accepts N/A.
 *
 * `e` OPENS the correction field; it never commits (that is Enter, inside the
 * field). Escalate has no hotkey — it is `act-escalate`, a button.
 *
 * `x` OBEYS THE SAME RULEBOOK GATE THE BUTTON DOES (R13). It was bound
 * unconditionally, so on `owner.zip` — where `✕ Not our party` is correctly
 * absent — the chord opened the editor anyway and the exclude posted 200. An
 * excluded row is GONE (`conflicts.md` C18).
 */
export function useReviewBindings({
  selected,
  mode,
  writes,
  advance,
  step,
  setMode,
  setBlankNote,
  openCorrect,
}: {
  selected: Field | null;
  mode: ReviewMode;
  writes: ReturnType<typeof useReviewWrites>;
  advance: () => void;
  step: (delta: number) => void;
  setMode: (mode: ReviewMode) => void;
  setBlankNote: (open: boolean) => void;
  openCorrect: () => void;
}) {
  const submitConfirm = () => {
    if (selected === null) return;
    writes.confirm(selected.id, selected.value, advance);
  };

  useReviewKeys(
    {
      next: () => step(1),
      previous: () => step(-1),
      confirm: () => (selected?.value == null ? setBlankNote(true) : submitConfirm()),
      correct: openCorrect,
      exclude: () => setMode("exclude"),
      pass: () => setMode("pass"),
    },
    {
      enabled: mode === "idle" && selected !== null,
      excludable: selected !== null && offersExclude(selected.path),
    },
  );

  return { submitConfirm };
}
