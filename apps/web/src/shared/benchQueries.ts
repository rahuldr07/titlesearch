import { BenchResultsResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

export const benchResults: ReadDescriptor<BenchResultsResponse> = {
  path: "/api/bench/results",
  key: ["bench", "results"],
  schema: BenchResultsResponse,
};
