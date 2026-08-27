import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EscalationsResponse,
  RulesResponse,
  type ResolveEscalationRequest,
} from "@titlepipe/contract";
import { get, post } from "../../shared/api";
import { notify } from "../../shared/notify";

/**
 * THE ESCALATION SCREEN'S DATA, AND THE ONE MUTATION IT IS ALLOWED.
 *
 * `GET /api/escalations` (handlers.ts:1389) and `GET /api/rules`
 * (handlers.ts:1407) are separate reads because they are separate objects: the
 * cluster is the question, the rulebook is the answer space, and joining them
 * client-side would put the rule catalog behind an escalation fetch.
 *
 * ══ THE REQUEST TYPE IS THE CONTRACT'S, NOT A LOCAL SHAPE ══════════════════
 *
 * `ResolveEscalationRequest` (endpoints.ts:238) is a union whose two arms ARE
 * `INVARIANTS:37`'s "exactly two resolution paths" — cite a rule id, or supply
 * a draft. Typing the mutation against it means a third path does not compile,
 * and means the client cannot post a resolution with no rule at all: the
 * `rule` key is required by the schema, so the refusal that
 * `endpoints.ts:233-236` states in prose is a TYPE ERROR here before it is a
 * 422 there. Both layers, deliberately — the server is the enforcement and
 * this is the thing that stops the wrong request being written.
 *
 * ══ NO OPTIMISTIC ANYTHING ═════════════════════════════════════════════════
 *
 * `INVARIANTS:4`. On success the queries are invalidated and the SERVER's
 * escalation and rule rows repaint. A drafted rule's `pending` status, in
 * particular, is a thing only the server can say — a client that painted the
 * new rule as it hoped it would land is a client that has shown a pending rule
 * as live.
 */
export function useEscalations() {
  return useQuery({
    queryKey: ["escalations"],
    queryFn: () => get("/api/escalations", EscalationsResponse),
  });
}

export function useRules() {
  return useQuery({
    queryKey: ["rules"],
    queryFn: () => get("/api/rules", RulesResponse),
  });
}

export function useResolveEscalation(escalationId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ResolveEscalationRequest) => {
      if (escalationId === null) {
        // Not reachable from the screen — the resolve card does not render
        // without a selected cluster. Thrown rather than silently no-op'd.
        throw new Error("No escalation selected.");
      }
      return post(`/api/escalations/${escalationId}/resolve`, OkResponse, body);
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["escalations"] }),
        client.invalidateQueries({ queryKey: ["rules"] }),
      ]);
    },
    // The server's sentence, verbatim (INVARIANTS:58-59). Never composed here.
    onError: (error: Error) => notify.error(error.message),
  });
}

/**
 * The engineer gate (handlers.ts:1410) — the ONLY thing that can make a
 * PENDING rule bind. Approving a candidate and drafting one are two different
 * acts by two different roles, which is the whole point of `INVARIANTS:38`.
 */
export function useConfirmRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => post(`/api/rules/${ruleId}/confirm`, OkResponse),
    onSuccess: () => client.invalidateQueries({ queryKey: ["rules"] }),
    onError: (error: Error) => notify.error(error.message),
  });
}

/**
 * The mock's `{ ok: true }` acknowledgement. A structural validator rather than
 * a zod schema, because `shared/api.ts` takes `Validator<T>` and this package
 * deliberately never imports zod into the browser bundle. The response carries
 * no state — the invalidated queries do — so there is nothing to parse beyond
 * "it is an object".
 */
const OkResponse = {
  safeParse: (input: unknown) =>
    ({ success: true, data: input }) as { success: true; data: unknown },
};
