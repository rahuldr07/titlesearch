import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GoldenCorrectionRequest, GoldenField } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { notify } from "../../shared/notify";

/**
 * THE SINGLE MOST CONSEQUENTIAL WRITE IN THE PRODUCT.
 *
 * `POST /api/golden/corrections` changes the RULER. Every bench run, every
 * engine comparison and every claim about accuracy anywhere in this system is
 * measured against the corpus this request edits, so a correction filed here
 * silently re-scores work that already happened.
 *
 * `endpoints.ts:285`: "source + reason, permanently logged and signed. The
 * signer is derived server-side from the authenticated session, NEVER declared
 * by the client — a browser must not decide who signed a change to ground truth
 * (that would be forgeable). The request carries the evidence (value + citation
 * + reason); the server stamps the actor."
 *
 * ══ THE REFUSAL IS CARRIED IN THREE PLACES, ON PURPOSE ═════════════════════
 *
 * Same construction as `escalations/ResolveCard`, for a rule at least as
 * strict:
 *   - the SERVER refuses (`handlers.ts:1341`, 422 off the contract schema) —
 *     the only enforcement that counts;
 *   - the request TYPE has no arm without a citation or a reason, because
 *     `GoldenCorrectionRequest` declares both `.min(1)`, so the wrong call does
 *     not compile against this mutation;
 *   - `correctionHold` states the missing part in words while the form is
 *     incomplete, because a control that is merely dead teaches nobody which of
 *     the three parts is absent.
 *
 * ══ NO OPTIMISTIC ANYTHING, AND NO RETRY ═══════════════════════════════════
 *
 * `INVARIANTS:4`. `shared/api.ts` already refuses to retry a mutation. On
 * success the corpus is invalidated and the SERVER's row repaints with its new
 * tag (`ruled`), its `corrected_from`, its stamped signer and its timestamp —
 * every one of which is a thing only the server can say.
 */
const OkResponse = {
  safeParse: (input: unknown): { success: true; data: unknown } => ({
    success: true,
    data: input,
  }),
};

export function useSeedCorrection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: GoldenCorrectionRequest) =>
      post("/api/golden/corrections", OkResponse, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["golden"] }),
    // INVARIANTS:14 — the server's message, verbatim. The client never authors
    // refusal text; this hands the sentence straight through.
    onError: (error: Error) => notify.error(error.message),
  });
}

/** What the form holds while it is incomplete. `null` means live (rule 9). */
export function correctionHold(input: {
  readonly seed: GoldenField | null;
  readonly corrected: string;
  readonly clearing: boolean;
  readonly citation: string;
  readonly reason: string;
  readonly signature: string;
  readonly sending: boolean;
}): string | null {
  if (input.seed === null) {
    return "Held: choose the field of the corpus this correction rewrites.";
  }
  if (input.signature.trim().length === 0) {
    return "Held: there is no session identity to sign this. An unsigned change to ground truth is forgeable, and the corpus exists to prevent exactly that.";
  }
  const next = input.clearing ? null : input.corrected;
  if (next === input.seed.value) {
    return "Held: this is the value the corpus already holds. A correction that changes nothing is not a correction — confirm the seed on the golden set instead.";
  }
  if (input.citation.trim().length === 0) {
    return "Held: refused without a source. A correction to the ruler that cites no document is an opinion (endpoints.ts:285).";
  }
  if (input.reason.trim().length === 0) {
    return "Held: refused without a reason. The reason is permanently logged beside the change and is what a later reader has to judge it by.";
  }
  if (input.sending) {
    return "Sending — the server has not answered yet. One act files one record.";
  }
  return null;
}
