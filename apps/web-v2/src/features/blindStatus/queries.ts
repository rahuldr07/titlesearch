import { queryOptions } from "@tanstack/react-query";
import { MetricsResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

export const metricsQuery = queryOptions({
  queryKey: ["metrics"],
  queryFn: () => get("/api/metrics", MetricsResponse),
});
