import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { RulesResponse } from "@titlepipe/contract";
import { get, post, type Validator } from "../../shared/api";

/**
 * `POST /api/rules/{id}/confirm` answers with a bare ack and the contract
 * carries no schema for it, so this is a local validator rather than a pretend
 * import. It still crosses the same boundary check: a body we did not expect
 * means the client and server disagree, and that is worth seeing even when the
 * expected body is one key long.
 */
const AckResponse: Validator<{ ok: true }> = {
  safeParse: (input) =>
    typeof input === "object" &&
    input !== null &&
    (input as { ok?: unknown }).ok === true
      ? { success: true, data: { ok: true } }
      : { success: false, error: { message: "expected { ok: true }" } },
};

/**
 * The rulebook's data.
 *
 * `GET /api/rules` is the only read the screen has. Everything else the design
 * draws around a rule — its provenance tag, the condition/outcome split, the
 * golden-set impact preview, the version log, the conflicting counterpart —
 * is absent from `Rule`, and the screen says so in place rather than inventing
 * a field. See the CONTRACT GAP notes on the panels themselves.
 *
 * The key matches the account tab's deliberately: both read the same list, and
 * a confirm on either surface must invalidate the other.
 */
export const rulesQuery = queryOptions({
  queryKey: ["rules"],
  queryFn: () => get("/api/rules", RulesResponse),
});

/**
 * THE ENGINEER GATE, and the whole reason the rulebook is two screens' worth of
 * ceremony: writing a rule and enabling it are separate acts by separate people.
 * A PENDING rule affects nothing until this call succeeds, and the server
 * refuses anyone who is not engineer or admin (`rule.confirm` in the authz
 * table). The UI hides the button too, but the hiding is courtesy — the refusal
 * is the rule.
 */
export function useConfirmRule() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      post(`/api/rules/${ruleId}/confirm`, AckResponse, {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ["rules"] }),
  });
}
