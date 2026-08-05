import { useRef } from "react";
import {
  useConfirmField,
  useCorrectField,
  useEscalateField,
  useExcludeField,
  usePassOrder,
} from "./queries";
import { latestRefusal } from "./refusal";

/**
 * THE FIVE DECISION WRITES, BEHIND ONE SEAM.
 *
 * The screen used to hold five `useMutation` results and wire each one by
 * hand. Four of the five were wired with `{ onSuccess: advance }` and nothing
 * else, so the server's refusal on `/correct`, `/escalate`, `/exclude` and
 * `/pass` was swallowed — the note came from `confirm.error` alone. Per-caller
 * wiring is exactly the shape that loses four of five: there is no line to
 * forget here, because there is no per-caller line.
 *
 * EVERY SUBMIT IS GUARDED. Three clicks on `edit-submit` under 4s latency filed
 * THREE correction records — three reason rows for one reviewer act, in the
 * table that feeds the rule channel. The editors make the control inert while
 * a write is in flight; this refuses the duplicate whatever the control did,
 * because a keyboard commit never touches the button at all.
 *
 * ONE PENDING FLAG, because exactly one editor is open at a time and the write
 * it fires is the only one that can be in flight underneath it.
 */
export interface ReviewWrites {
  /** The server's message for the most recent submission, verbatim, or null. */
  serverNote: string | null;
  pending: boolean;
  confirm: (fieldId: string, value: string | null, done: () => void) => void;
  correct: (fieldId: string, value: string, reason: string, done: () => void) => void;
  escalate: (fieldId: string, question: string, done: () => void) => void;
  exclude: (fieldId: string, reason: string, done: () => void) => void;
  pass: (reason: string, done: () => void) => void;
}

export function useReviewWrites(orderId: string): ReviewWrites {
  const confirm = useConfirmField(orderId);
  const correct = useCorrectField(orderId);
  const escalate = useEscalateField(orderId);
  const exclude = useExcludeField(orderId);
  const pass = usePassOrder(orderId);
  const all = [confirm, correct, escalate, exclude, pass];

  /*
   * THE LATCH IS SYNCHRONOUS, AND IT HAS TO BE.
   *
   * `isPending` is a RENDER-TIME value. Every one of these five closures
   * captured it when the component last rendered, so a second click that arrives
   * before React has re-rendered reads the same stale `false` the first one did
   * and fires a second mutation. The guard was real but it was racing a render.
   *
   * IT FAILED IN THE REAL SUITE, not in theory: `review-refusals.spec`'s
   * "three clicks … file exactly one correction" recorded TWO posts under load,
   * while passing every time on an idle machine. That test's own words are the
   * rule — one reviewer act files ONE record, WHATEVER THE LATENCY — and a guard
   * that holds only when the machine is fast does not meet it.
   *
   * A ref mutates in place, so the entry is visible to the very next event
   * handler in the same tick, with no render in between. `isPending` stays in
   * the condition beside it: the ref catches the race, and `isPending` still
   * catches a mutation started from anywhere that did not come through here.
   *
   * CLEARED ON SETTLED, NOT ON SUCCESS. A refusal is an answer — a 409, a 422
   * with a reason — and the reviewer must be able to fix the input and submit
   * again. Clearing only on success would latch the control shut for the rest of
   * the session on the exact path where retrying is the point.
   */
  const inFlight = useRef(new Set<string>());
  const claim = (key: string, pending: boolean): boolean => {
    if (pending || inFlight.current.has(key)) return false;
    inFlight.current.add(key);
    return true;
  };
  const release = (key: string) => () => {
    inFlight.current.delete(key);
  };

  return {
    serverNote: latestRefusal(all),
    pending: all.some((write) => write.isPending),
    confirm: (fieldId, value, done) => {
      if (!claim("confirm", confirm.isPending)) return;
      confirm.mutate({ fieldId, value }, { onSuccess: done, onSettled: release("confirm") });
    },
    correct: (fieldId, value, reason, done) => {
      if (!claim("correct", correct.isPending)) return;
      correct.mutate(
        { fieldId, value, reason },
        { onSuccess: done, onSettled: release("correct") },
      );
    },
    escalate: (fieldId, question, done) => {
      if (!claim("escalate", escalate.isPending)) return;
      escalate.mutate({ fieldId, question }, { onSuccess: done, onSettled: release("escalate") });
    },
    exclude: (fieldId, reason, done) => {
      if (!claim("exclude", exclude.isPending)) return;
      exclude.mutate({ fieldId, reason }, { onSuccess: done, onSettled: release("exclude") });
    },
    pass: (reason, done) => {
      if (!claim("pass", pass.isPending)) return;
      pass.mutate(reason, { onSuccess: done, onSettled: release("pass") });
    },
  };
}
