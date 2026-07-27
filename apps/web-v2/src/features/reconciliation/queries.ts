import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReconciliationResponse } from "@titlepipe/contract";
import { get, post, type Validator } from "../../shared/api";

const Ack: Validator<{ ok: true }> = {
  safeParse: (input) =>
    typeof input === "object" && input !== null && (input as { ok?: unknown }).ok === true
      ? { success: true, data: { ok: true } }
      : { success: false, error: { message: "expected { ok: true }" } },
};

export function reconciliationQuery(orderId: string) {
  return queryOptions({
    queryKey: ["reconciliation", orderId],
    queryFn: () => get(`/api/reconciliation/${orderId}`, ReconciliationResponse),
  });
}

export interface RulingBody {
  path: string;
  ruling_value: string | null;
  citation: string;
  reason?: string;
  general_rule_draft?: { text: string };
}

/**
 * A RULING IS REFUSED WITHOUT A CITATION — §4.13, and the contract enforces it
 * (`citation: z.string().min(1)`). Every ruling here is permanent ground truth:
 * it is not a backlog being cleared, it is law being written, and law nobody can
 * check against a document is an opinion that outlives the person who held it.
 *
 * A GENERAL RULE LANDS PENDING. Filing one costs almost nothing precisely
 * because it is inert until an engineer confirms — which is what makes it safe
 * to file the moment you notice the pattern, rather than after you have
 * convinced yourself it generalises.
 */
export function useRuleDivergence(orderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: RulingBody) => post(`/api/reconciliation/${orderId}`, Ack, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["reconciliation", orderId] }),
  });
}
