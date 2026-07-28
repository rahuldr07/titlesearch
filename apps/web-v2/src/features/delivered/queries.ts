import { queryOptions } from "@tanstack/react-query";
import { DeliveriesResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * The deliveries list, parsed at the boundary like every other response.
 *
 * Declared here rather than imported from `features/delivery` because a
 * cross-feature import is a build failure (§7) — features share through
 * `shared/` and `entities/`, not through each other. The key is deliberately
 * the SAME `["deliveries"]` the list screen uses: two keys for one resource
 * would let the confirmation screen and the delivery list disagree about
 * whether a retry landed, which is exactly the kind of split-brain the shared
 * cache exists to prevent.
 */
export const deliveriesQuery = queryOptions({
  queryKey: ["deliveries"],
  queryFn: () => get("/api/deliveries", DeliveriesResponse),
});
