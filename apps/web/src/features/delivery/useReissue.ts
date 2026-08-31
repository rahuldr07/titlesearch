import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ReissueResponse } from "@titlepipe/contract";
import { post } from "../../shared/api";
import { notify } from "../../shared/notify";

/**
 * `POST /api/deliveries/{id}/reissue` — one act, no retry, nothing optimistic.
 * The reissued report is the server's answer; the ledger repaints from the wire.
 */
export function useReissue(deliveryId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      post(`/api/deliveries/${deliveryId}/reissue`, ReissueResponse, { reason }),
    onSuccess: async () => {
      // The reissue files an audit event server-side, so the audit read is
      // stale the moment this succeeds.
      await Promise.all([
        client.invalidateQueries({ queryKey: ["deliveries"] }),
        client.invalidateQueries({ queryKey: ["audit"] }),
      ]);
    },
    // The server's sentence, verbatim — never composed here.
    onError: (error: Error) => notify.error(error.message),
  });
}

/**
 * Why the act is held — `null` means live. Only client-knowable causes:
 * permission and supersession are the server's to refuse (403/409, in its own
 * words).
 */
export function reissueHold(reason: string, sending: boolean): string | null {
  if (sending) {
    return "Sending — the server has not answered yet. One act files one record.";
  }
  if (reason.trim().length === 0) {
    return "Held: a reissue is refused without its reason. The reason goes on the record beside the new version.";
  }
  return null;
}
