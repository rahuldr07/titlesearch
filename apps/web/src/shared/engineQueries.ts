import {
  EnginesResponse,
  LeaderboardResponse,
  RoutingResponse,
  type Engine,
  type EngineRoutingCell,
} from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/** Per engine × section × jurisdiction, measured against the golden set. */
export const engineLeaderboard: ReadDescriptor<LeaderboardResponse> = {
  path: "/api/engines/leaderboard",
  key: ["engines", "leaderboard"],
  schema: LeaderboardResponse,
};

/** The roster. */
export const engines: ReadDescriptor<{ engines: Engine[] }> = {
  path: "/api/engines",
  key: ["engines"],
  schema: EnginesResponse,
};

/** Current seats, each carrying `approved_by` / `approved_at` / `evidence_url`. */
export const engineRouting: ReadDescriptor<{ cells: EngineRoutingCell[] }> = {
  path: "/api/engines/routing",
  key: ["engines", "routing"],
  schema: RoutingResponse,
};
