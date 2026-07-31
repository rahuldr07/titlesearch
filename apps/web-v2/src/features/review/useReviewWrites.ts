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

  return {
    serverNote: latestRefusal(all),
    pending: all.some((write) => write.isPending),
    confirm: (fieldId, value, done) => {
      if (confirm.isPending) return;
      confirm.mutate({ fieldId, value }, { onSuccess: done });
    },
    correct: (fieldId, value, reason, done) => {
      if (correct.isPending) return;
      correct.mutate({ fieldId, value, reason }, { onSuccess: done });
    },
    escalate: (fieldId, question, done) => {
      if (escalate.isPending) return;
      escalate.mutate({ fieldId, question }, { onSuccess: done });
    },
    exclude: (fieldId, reason, done) => {
      if (exclude.isPending) return;
      exclude.mutate({ fieldId, reason }, { onSuccess: done });
    },
    pass: (reason, done) => {
      if (pass.isPending) return;
      pass.mutate(reason, { onSuccess: done });
    },
  };
}
