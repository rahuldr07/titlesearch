import { queryOptions } from "@tanstack/react-query";
import { BenchResultsResponse, RulesResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

export const benchResultsQuery = queryOptions({
  queryKey: ["bench", "results"],
  queryFn: () => get("/api/bench/results", BenchResultsResponse),
});

/**
 * The prompt's rule context. THE PROMPT IS GENERATED FROM THE RULEBOOK, not
 * hand-tuned per engine — a rule change propagates everywhere at once, and
 * per-engine prompt surgery is how two engines quietly start answering
 * different questions.
 *
 * PENDING RULES ARE FILTERED OUT AT THE CALL SITE, not here, so the filter is
 * visible next to the copy that explains it: a pending rule cannot affect the
 * pipeline until an engineer confirms it, and a prompt IS the pipeline.
 */
export const rulesQuery = queryOptions({
  queryKey: ["rules"],
  queryFn: () => get("/api/rules", RulesResponse),
});
