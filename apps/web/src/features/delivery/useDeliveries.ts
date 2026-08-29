import { useQuery } from "@tanstack/react-query";
import { DeliveriesResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * `GET /api/deliveries` (handlers.ts:981) — the ONLY read this screen has.
 *
 * `DeliveriesResponse` embeds the report (`DeliveryWithReport`,
 * endpoints.ts:617) so a row can name its order and version without a second
 * round-trip, and endpoints.ts:615-616 records why both v1 and v2 appear: "the
 * pair is the defect record."
 *
 * There is no `useRetryDelivery` here, and its absence is deliberate rather
 * than pending. `delivery.retry` (authz.ts:118) is `ops`/`admin` and belongs to
 * the transit-failure path — a retry re-SENDS the same file and never
 * re-renders the report (handlers.ts:987). This screen is the DELIVERED record;
 * building a retry into it would put a mutation on a screen whose whole subject
 * is what has already happened.
 */
export function useDeliveries() {
  return useQuery({
    queryKey: ["deliveries"],
    queryFn: () => get("/api/deliveries", DeliveriesResponse),
  });
}
