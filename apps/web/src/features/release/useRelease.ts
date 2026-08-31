import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ReleaseResponse, type CompositionResponse } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { notify } from "../../shared/notify";

/**
 * One POST, no retry, no optimistic anything — the server's returned seal is
 * the only evidence a release happened, so the composition is invalidated and
 * repainted from the wire.
 */
export function useRelease(orderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (signature: string) =>
      post(`/api/orders/${orderId}/release`, ReleaseResponse, { signature }),
    onSuccess: async () => {
      // The release files an audit event server-side.
      await Promise.all([
        client.invalidateQueries({ queryKey: ["orders", orderId, "composition"] }),
        client.invalidateQueries({ queryKey: ["audit"] }),
      ]);
    },
    // The server's sentence, verbatim — never composed here.
    onError: (error: Error) => notify.error(error.message),
  });
}

/**
 * Why the act is held, one sentence per cause — `null` means live. Only
 * client-knowable causes: an open gate is not one of them, because
 * `releasable` is the server's verdict and the server issues its own refusal
 * (409) when the button is pressed. The verdict is still drawn, verbatim,
 * beside the button.
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
