import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GoldenAffirmRequest, GoldenField } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { notify } from "../../shared/notify";

/**
 * THE TWO SEED ACTS, AND THE SENTENCE THAT HOLDS THEM.
 *
 * `endpoints.ts:285-310` — "SeedCorrection §4.9: three actions, nothing else".
 * Two of the three are here, and both leave the VALUE untouched:
 *
 *   confirm — the seed is right; the model failure is real. Tag upgrades to
 *             `ruled` (now human-verified, not merely typed).
 *   demote  — the document is ambiguous; neither value can be confirmed.
 *             Tag → `suspect`, which the contract calls a DIAGNOSIS (PRD §12),
 *             not a failure.
 *
 * The third — a correction, which changes the value — is a different screen and
 * a different request, because it needs a source citation these two do not.
 *
 * ══ THE ACT IS SIGNED, AND THE SIGNATURE IS NOT TYPEABLE ═══════════════════
 *
 * `endpoints.ts:296-299`: "the action is still signed, but by the
 * SERVER-DERIVED session identity (an unsigned change to ground truth is the
 * failure the corpus exists to prevent, and a client-declared signer would be
 * forgeable)." So `GoldenAffirmRequest` has exactly one member, `reason`, and
 * there is no field on it for who did this. `shared/api.ts` carries the session
 * identity in a header the form never touches.
 *
 * ══ NO OPTIMISTIC ANYTHING ═════════════════════════════════════════════════
 *
 * `INVARIANTS:4`. On success the corpus is invalidated and the SERVER's row
 * repaints — its new tag, its new signer, its new timestamp. A client that
 * painted `ruled` as it hoped it would land is a client that has shown a
 * verification nobody performed.
 */
export type SeedActMode = "confirm" | "demote";

/**
 * The mock's `{ ok: true }` acknowledgement, as a structural validator rather
 * than a zod schema — `shared/api.ts` takes `Validator<T>` and this app never
 * imports zod into the browser bundle. The response carries no state; the
 * invalidated query does.
 */
const OkResponse = {
  safeParse: (input: unknown): { success: true; data: unknown } => ({
    success: true,
    data: input,
  }),
};

export function useSeedAct(seedId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { act: SeedActMode; body: GoldenAffirmRequest }) =>
      post(`/api/golden/${seedId}/${input.act}`, OkResponse, input.body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["golden"] }),
    // The server's sentence, verbatim (INVARIANTS:14). Never composed here.
    // The toast is the nudge; the durable copy renders on the row itself,
    // because a refusal the reader dismissed is a refusal they cannot re-read.
    onError: (error: Error) => notify.error(error.message),
  });
}

/**
 * WHY AN ACT IS HELD, one sentence per cause — the construction
 * `escalations/holdReason.ts` uses, and for the same reason: `null` means live,
 * because this kit has no boolean disabled prop and a reason IS the
 * disablement (rule 9, `components/ui/disabled.ts`).
 *
 * A sentence per cause rather than "complete the form". The missing thing here
 * is a REASON, permanently logged against the ruler every future measurement is
 * taken with, and a reader who sees a dead button learns nothing about that.
 *
 * The already-resolved branch is a BLOCK, not a refusal: it is drawn from the
 * server's own `corrected_at` and `corrected_by` rather than derived from
 * anything. The server still refuses independently — `handlers.ts` 409s "seed
 * already resolved" — and that 409 surfaces verbatim if it ever arrives, which
 * is `INVARIANTS:16`. Both layers, deliberately.
 */
export function seedActHold(
  seed: GoldenField,
  reason: string,
  signature: string,
  sending: boolean,
): string | null {
  if (seed.corrected_at !== null) {
    return `Already resolved — signed by ${seed.corrected_by ?? "an unnamed actor"}. A seed act is permanent and files once.`;
  }
  if (signature.trim().length === 0) {
    return "Held: there is no session identity to sign this. An unsigned change to ground truth is the failure the corpus exists to prevent.";
  }
  if (reason.trim().length === 0) {
    return "Held: a seed act is refused without a reason. It is permanently logged against the ruler every score is measured with.";
  }
  if (sending) {
    return "Sending — the server has not answered yet. One act files one record.";
  }
  return null;
}
