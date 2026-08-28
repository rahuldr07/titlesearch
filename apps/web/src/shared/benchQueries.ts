import { BenchResultsResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * THE BENCH'S ONE READ. Same rule as `queries.ts` and `accountQueries.ts`: this
 * file carries the DESCRIPTION of a read and never performs one, because
 * `check-rules.mjs` keeps `@tanstack/react-query` out of `shared/`.
 * `app/useRead.ts` is the three lines that fetch.
 *
 * ══ WHAT IS DELIBERATELY ABSENT ════════════════════════════════════════════
 *
 * THERE IS NO `/api/metrics` DESCRIPTOR HERE, and its absence is the point.
 * That endpoint carries `probes_planted`, `probes_caught` and `catch_rate`
 * (`endpoints.ts:432-437`), and AGENTS.md bans probe visibility outright: "no
 * probe visibility" is listed beside "no aggregate accuracy headline" as an
 * anti-pattern whose reintroduction is a defect rather than a feature request.
 * The bench screen is the single most plausible place in the product for a
 * probe figure to appear — it is the screen about whether the machine is right
 * — so the read is not available to it at all.
 *
 * There is likewise no descriptor for a bench RUN. `/api/bench/results` serves
 * the results of one run identified by `run_ref`; there is no run list, no run
 * picker and no compare-two-runs endpoint, and inventing one in the browser
 * would be the first line of a trend line — which is an aggregate over time,
 * the thing `endpoints.ts:336-339` says this shape deliberately does not carry.
 */
export const benchResults: ReadDescriptor<BenchResultsResponse> = {
  path: "/api/bench/results",
  key: ["bench", "results"],
  schema: BenchResultsResponse,
};
