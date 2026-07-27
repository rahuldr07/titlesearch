import { queryOptions } from "@tanstack/react-query";
import { DerivedSignalResponse, MetricsResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * The readout's data. Everything here is a SERVER-AUTHORED number — the client
 * computes nothing, not even a percentage denominator.
 *
 * `dashboard.spec` #3: drill-downs are server-authored. The client asks for a
 * signal and renders the rows it is given; it does not assemble a history from
 * anything it already has.
 */
export const metricsQuery = queryOptions({
  queryKey: ["metrics"],
  queryFn: () => get("/api/metrics", MetricsResponse),
});

export function derivedSignalQuery(signal: string) {
  return queryOptions({
    queryKey: ["derived", signal],
    queryFn: () => get(`/api/derived/${signal}`, DerivedSignalResponse),
  });
}
