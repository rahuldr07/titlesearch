import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { EscalationsResponse, RulesResponse } from "@titlepipe/contract";
import { get, post, type Validator } from "../../shared/api";

const Ack: Validator<{ ok: true }> = {
  safeParse: (input) =>
    typeof input === "object" &&
    input !== null &&
    (input as { ok?: unknown }).ok === true
      ? { success: true, data: { ok: true } }
      : { success: false, error: { message: "expected { ok: true }" } },
};

export const escalationsQuery = queryOptions({
  queryKey: ["escalations"],
  queryFn: () => get("/api/escalations", EscalationsResponse),
});

export const rulesQuery = queryOptions({
  queryKey: ["rules"],
  queryFn: () => get("/api/rules", RulesResponse),
});

export type RuleChoice = { rule_id: string } | { draft: { text: string } };

/**
 * RESOLUTION IS REFUSED WITHOUT A RULE — ruling D1, and the contract enforces
 * it: `rule` is not optional, so a bare ruling is a 422 at the schema. The rule
 * IS the resolution; the per-order answer is incidental. Without it the same
 * question arrives again next week from a different reviewer.
 *
 * CONTRACT GAP: resolve is PER ESCALATION, but the cluster is the unit of
 * judgment — one wall that several people hit. So a cluster resolution is a
 * LOOP of POSTs and is NOT ATOMIC: a 403 or 409 partway leaves the cluster half
 * resolved with no rollback, and a drafted rule is minted once per escalation
 * rather than once per cluster. Both need a cluster-level endpoint. Until then
 * the screen reports what actually happened rather than hiding the split.
 */
export function useResolveCluster() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ids: readonly string[];
      ruling: string;
      rule: RuleChoice;
    }) => {
      for (const id of input.ids) {
        await post(`/api/escalations/${id}/resolve`, Ack, {
          ruling: input.ruling,
          rule: input.rule,
        });
      }
      return { resolved: input.ids.length };
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["escalations"] });
      await client.invalidateQueries({ queryKey: ["rules"] });
    },
  });
}
