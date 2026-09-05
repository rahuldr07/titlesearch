import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PassOrderResponse } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { queueNext } from "../../shared/queries";
import { notify } from "../../shared/notify";

/**
 * RECORDING A PASS, AND ADVANCING BY ASKING RATHER THAN BY STEPPING.
 *
 * `INVARIANTS:87`: "a reasoned pass records and THE SERVER serves the next
 * order." Both halves are load-bearing and this is where the second one lives.
 *
 * ══ ADVANCING IS A REFETCH, NOT AN INCREMENT ═══════════════════════════════
 *
 * There is no local list to step through — that is the whole of `INVARIANTS:82`
 * — so "next" is not `index + 1`. It is `GET /api/queue/next` asked again, and
 * the server may answer with something other than whatever was second a moment
 * ago: a colleague may have taken it, a gate may have halted it, a fourth pass
 * may have auto-escalated it. A client that incremented a cursor would be
 * holding an opinion about queue order, which is the cherry-pick expressed as
 * arithmetic.
 *
 * ══ THE RESPONSE CARRIES NOTHING AND THAT IS DELIBERATE ════════════════════
 *
 * `PassOrderResponse` is `{ ok: true }` and nothing else. `endpoints.ts:206-210`
 * says why: "pass counts and escalation triggers NEVER COME BACK TO THE
 * CLIENT" — the 4th pass auto-escalates server-side and "the UI just calls and
 * moves on." So there is no count to render, no "3 of 4 passes used" hint, and
 * no way for this screen to learn one. A pass counter on screen would also be a
 * per-person tally, which §4.5 forbids outright.
 *
 * ══ THE SERVER'S REFUSAL, VERBATIM ═════════════════════════════════════════
 *
 * `INVARIANTS:58-59`: a refused mutation surfaces the server's message
 * verbatim; the client never authors the refusal text. A 403 from the role gate
 * (`order.pass` is reviewer + admin, `authz.ts:86`) and a 422 from the schema
 * both arrive as `ApiError.message` and both are shown unedited. Neither
 * advances the queue: the reviewer still holds the order, which is what the
 * refusal means.
 */
export function usePassOrder(order: { readonly id: string; readonly ref: string } | null) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) => {
      if (order === null) {
        // Not reachable from the UI — the control is not drawn without an
        // order — but a mutation that would POST to `/api/orders//pass` is
        // worth refusing here rather than debugging as a 404.
        return Promise.reject(new Error("No order is being served."));
      }
      return post(`/api/orders/${order.id}/pass`, PassOrderResponse, { reason });
    },
    onSuccess: async () => {
      const passed = order?.ref ?? "";
      await client.invalidateQueries({ queryKey: queueNext.key });
      notify.success(`Recorded — passed ${passed}`);
    },
    onError: (error: Error) => notify.error(error.message),
  });
}
