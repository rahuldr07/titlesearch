import { useHotkeys } from "react-hotkeys-hook";
import { useGlobalKeysHold } from "../../shared/keyboard";

export interface ReviewKeyHandlers {
  next: () => void;
  previous: () => void;
  confirm: () => void;
  correct: () => void;
  escalate: () => void;
  exclude: () => void;
  pass: () => void;
}

/**
 * The review workstation's keys.
 *
 * THEY STAND DOWN WHILE THE GLOBAL LAYER HAS THE KEYBOARD. An armed `g` chord
 * must reach escalations without also opening the escalate editor
 * (`navigation.spec` #2), and the key map is modal — `c` must not open an
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
  useHotkeys("enter", handlers.confirm, { enabled: on, preventDefault: true }, [
    handlers.confirm,
    on,
  ]);
  useHotkeys("c", handlers.correct, { enabled: on, preventDefault: true }, [
    handlers.correct,
    on,
  ]);
  useHotkeys("e", handlers.escalate, { enabled: on, preventDefault: true }, [
    handlers.escalate,
    on,
  ]);
  useHotkeys("x", handlers.exclude, { enabled: on, preventDefault: true }, [handlers.exclude, on]);
  useHotkeys("p", handlers.pass, { enabled: on, preventDefault: true }, [handlers.pass, on]);
}
