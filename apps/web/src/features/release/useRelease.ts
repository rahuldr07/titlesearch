import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ReleaseResponse, type CompositionResponse } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { notify } from "../../shared/notify";

/**
 * THE RELEASE ACT. One POST, no retry, no optimistic anything — the server's
 * returned seal is the only evidence a release happened, so the composition is
 * invalidated and repainted from the wire.
 */
export function useRelease(orderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (signature: string) =>
      post(`/api/orders/${orderId}/release`, ReleaseResponse, { signature }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["orders", orderId, "composition"] }),
    // The server's sentence, verbatim (INVARIANT 14). Never composed here.
    onError: (error: Error) => notify.error(error.message),
  });
}

/**
 * WHY THE ACT IS HELD, one sentence per cause — `null` is live, because rule 9
 * makes the reason the disablement.
 *
 * ONLY CLIENT-KNOWABLE CAUSES ARE HELD HERE. An open gate is NOT one of them:
 * `releasable` is the server's verdict and the server issues its own refusal
 * (409) when the button is pressed. Pre-empting it here would replace the
 * server's sentence with ours, which is the thing INVARIANT 14 forbids — the
 * verdict is still drawn, verbatim, beside the button.
 */
export function releaseHold(
  composed: CompositionResponse,
  signature: string,
  sending: boolean,
): string | null {
  if (composed.seal_sha256 !== null) {
    return "Already released and sealed. A release files once and the seal is the record of it.";
  }
  if (sending) {
    return "Sending — the server has not answered yet. One act files one record.";
  }
  if (signature.trim().length === 0) {
    return "Held: a release is refused without its signature. Nothing leaves this desk unsigned.";
  }
  return null;
}
