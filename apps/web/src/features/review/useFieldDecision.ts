import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ConfirmFieldRequest,
  CorrectFieldRequest,
  EscalateFieldRequest,
  Ack,
} from "@titlepipe/contract";
import { api, ApiError } from "../../api";

/**
 * Field decisions — confirm, correct, escalate.
 *
 * NO OPTIMISTIC UPDATES. The server's returned state is the truth (constraint
 * 10). Every mutation invalidates the field list and the UI repaints from
 * whatever the server then says. This is not a performance oversight: an
 * optimistic confirm shows a reviewer a decision the server has not accepted,
 * and confirm can legitimately be REFUSED — bug-5 returns 409 on a conflicting
 * value or a terminal state. Painting success first and reconciling later would
 * flash an accepted decision that was rejected.
 *
 * A 409 is an ANSWER, not a dead no-op. The caller surfaces the server's own
 * message verbatim and does NOT advance the selection.
 */

export interface DecisionError {
  readonly message: string;
  readonly status: number;
}

function toDecisionError(e: unknown): DecisionError {
  if (e instanceof ApiError) return { message: e.message, status: e.status };
  return { message: e instanceof Error ? e.message : String(e), status: 0 };
}

export function useFieldDecision(orderId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["orders", orderId, "fields"] });

  const confirm = useMutation({
    mutationFn: async (v: { fieldId: string; value: string | null }) =>
      api(Ack, `/api/fields/${v.fieldId}/confirm`, {
        method: "POST",
        body: JSON.stringify(ConfirmFieldRequest.parse({ value: v.value })),
      }),
    onSettled: invalidate,
  });

  const correct = useMutation({
    mutationFn: async (v: {
      fieldId: string;
      value: string | null;
      reason: string;
    }) =>
      api(Ack, `/api/fields/${v.fieldId}/correct`, {
        method: "POST",
        // zodResolver already refused an empty reason in the form; parsing here
        // too means a programmatic caller cannot bypass it either. The SERVER
        // refuses independently — the client rule is ergonomics, not the gate
        // (constraint 14).
        body: JSON.stringify(
          CorrectFieldRequest.parse({ value: v.value, reason: v.reason }),
        ),
      }),
    onSettled: invalidate,
  });

  const escalate = useMutation({
    mutationFn: async (v: { fieldId: string; question: string }) =>
      api(Ack, `/api/fields/${v.fieldId}/escalate`, {
        method: "POST",
        body: JSON.stringify(
          EscalateFieldRequest.parse({ question: v.question }),
        ),
      }),
    onSettled: invalidate,
  });

  const error =
    confirm.error ?? correct.error ?? escalate.error
      ? toDecisionError(confirm.error ?? correct.error ?? escalate.error)
      : null;

  return {
    confirm,
    correct,
    escalate,
    error,
    pending: confirm.isPending || correct.isPending || escalate.isPending,
    reset: () => {
      confirm.reset();
      correct.reset();
      escalate.reset();
    },
  };
}
