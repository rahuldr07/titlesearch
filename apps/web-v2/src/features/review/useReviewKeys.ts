import { useHotkeys } from "react-hotkeys-hook";
import { useGlobalKeysHold } from "../../shared/keyboard";

export interface ReviewKeyHandlers {
  next: () => void;
  previous: () => void;
  confirm: () => void;
  correct: () => void;
  exclude: () => void;
  pass: () => void;
}

/**
 * The review workstation's keys — the design's decision legend, `C confirm ·
 * E correct` (2026-07-28 revision). `c` confirms; `e` OPENS the correction
 * field (it does not commit — Enter inside the field does that, see
 * `CorrectEditor`). Escalate has NO hotkey: it is a button (`act-escalate`),
 * because an accidental keystroke must never send a senior a question.
 *
 * THEY STAND DOWN WHILE THE GLOBAL LAYER HAS THE KEYBOARD. An armed `g` chord
 * must reach escalations without also opening the correction editor
 * (`navigation.spec` #2), and the key map is modal — `e` must not open an
 * editor underneath it (`navigation.spec` #3). One flag, both cases, because
 * they are the same rule: a key belongs to exactly one layer at a time.
 *
 * KEYS TYPED INSIDE AN INPUT ARE TEXT. react-hotkeys-hook does not fire inside
 * form fields by default, which is what stops "gd" typed into a correction from
 * navigating away and destroying the correction (`hard.spec` #5).
 */
export function useReviewKeys(handlers: ReviewKeyHandlers, enabled: boolean) {
  const held = useGlobalKeysHold();
  const on = enabled && !held;

  useHotkeys("j", handlers.next, { enabled: on, preventDefault: true }, [handlers.next, on]);
  useHotkeys("k", handlers.previous, { enabled: on, preventDefault: true }, [
    handlers.previous,
    on,
  ]);
  useHotkeys("c", handlers.confirm, { enabled: on, preventDefault: true }, [
    handlers.confirm,
    on,
  ]);
  useHotkeys("e", handlers.correct, { enabled: on, preventDefault: true }, [
    handlers.correct,
    on,
  ]);
  useHotkeys("x", handlers.exclude, { enabled: on, preventDefault: true }, [handlers.exclude, on]);
  useHotkeys("p", handlers.pass, { enabled: on, preventDefault: true }, [handlers.pass, on]);
}
