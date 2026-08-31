import { useQuery } from "@tanstack/react-query";
import { DeliveriesResponse, ReissueReasonsResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * The only read this screen has; the response embeds each delivery's report so
 * a row can name its order and version without a second round-trip.
 *
 * No retry hook here, deliberately: a retry re-sends the same file and never
 * re-renders the report, and this screen is the delivered record — no place
 * for a mutation.
 */
export function useDeliveries() {
  return useQuery({
    queryKey: ["deliveries"],
    queryFn: () => get("/api/deliveries", DeliveriesResponse),
  });
}

/**
 * The reissue reason vocabulary is served — the browser never puts its own
 * words on the lender's record.
 */
export function useReissueReasons() {
  return useQuery({
    queryKey: ["reissue", "reasons"],
    queryFn: () => get("/api/reissue/reasons", ReissueReasonsResponse),
  });
}
