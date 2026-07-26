/**
 * Keyboard-layer guard.
 *
 * One-key-per-action is a product requirement (master §3), and the design draws
 * the hints — so single-letter keys are live on the review screen. The whole
 * thing is only safe because of this guard:
 *
 * TYPED TEXT NEVER TRIGGERS AN ACTION (orphan rule O15). A reviewer typing a
 * correction reason containing "c" or "e", or pressing Enter to submit it, must
 * not have those keys stolen by the screen. The failure mode is silent data
 * loss mid-edit — the reviewer's half-written reason vanishes because a letter
 * was read as a command.
 *
 * Kept as its own module so both listeners (selection movement in ReviewScreen,
 * decision keys in FieldActions) share exactly one definition of "the user is
 * typing" rather than each having a near-copy that can drift.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}
