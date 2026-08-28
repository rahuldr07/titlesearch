import {
  EnginesResponse,
  LeaderboardResponse,
  RoutingResponse,
  type Engine,
  type EngineRoutingCell,
} from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * THE ENGINE LAYER'S THREE READS. Descriptions only — `shared/` may not import
 * `@tanstack/react-query` (`check-rules.mjs`), so `app/useRead.ts` fetches.
 *
 * Three reads rather than one join, because they are three different KINDS of
 * fact and only the server may relate them:
 *
 *   - the roster is what each engine DECLARES about itself;
 *   - the leaderboard is per engine × section × jurisdiction measurement
 *     against the golden set;
 *   - routing is which engine currently sits in which seat, and who put it
 *     there with what evidence.
 *
 * Joining them client-side would produce the one thing this product refuses: a
 * screen that reads a measurement and a seat together and implies the first
 * caused the second. Nothing auto-promotes (AGENTS.md, "no auto-tuning"). A
 * seat is a human act with a signature and an evidence link, and the routing
 * payload carries both because the promotion is the RECORD, not an inference.
 *
 * ══ THE PATH IS `/api/engines/leaderboard` ═════════════════════════════════
 *
 * Not `/api/leaderboard`. The reading belongs to the engine, and the route says
 * so. Written once here so no screen spells it a second way.
 */

/**
 * Per engine × section × jurisdiction, measured against the golden set.
 *
 * `endpoints.ts:411` and `entities.ts:271-274`: "There is deliberately no
 * aggregate/headline accuracy schema in this contract", and a cell below the
 * golden coverage threshold carries `no_truth_yet` and shows NO NUMBER AT ALL.
 * The absent aggregate is not an oversight to be filled in by the browser.
 */
export const engineLeaderboard: ReadDescriptor<LeaderboardResponse> = {
  path: "/api/engines/leaderboard",
  key: ["engines", "leaderboard"],
  schema: LeaderboardResponse,
};

/**
 * The roster. Capabilities are DECLARED, never faked (AGENTS.md) — `kind` is
 * what the adapter says it is, and nothing on the screen infers a capability
 * from a measurement.
 *
 * Typed structurally rather than as `EnginesResponse`, because
 * `endpoints.ts:653` exports the SCHEMA under that name with no inferred type
 * beside it. Same shape of workaround as `accountQueries.ts`'s `rules`, and for
 * the same reason: `packages/contract` is not this app's to edit.
 */
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
