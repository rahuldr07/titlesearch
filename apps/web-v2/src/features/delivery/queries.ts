import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { DeliveriesResponse } from "@titlepipe/contract";
import { get, post, type Validator } from "../../shared/api";

const AckResponse: Validator<{ ok: true }> = {
  safeParse: (input) =>
    typeof input === "object" && input !== null && (input as { ok?: unknown }).ok === true
      ? { success: true, data: { ok: true } }
      : { success: false, error: { message: "expected { ok: true }" } },
};

export const deliveriesQuery = queryOptions({
  queryKey: ["deliveries"],
  queryFn: () => get("/api/deliveries", DeliveriesResponse),
});

/**
 * Retry. A failed delivery is a TRANSIT problem, so retrying sends the same
 * file and the same report version — nothing is regenerated, because nothing
 * about the report was wrong.
 *
 * A retry that fails again surfaces the SERVER'S message verbatim
 * (`errors.spec` #7). "Something went wrong" would hide the one useful fact:
 * whether the client's mail server bounced it or our credential expired.
 */
export function useRetryDelivery() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) =>
      post(`/api/deliveries/${deliveryId}/retry`, AckResponse, {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ["deliveries"] }),
  });
}
