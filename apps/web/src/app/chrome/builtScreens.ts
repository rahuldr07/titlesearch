import type { JSX } from "react";
import { IngestScreen } from "../../features/ingest/IngestScreen";
import { OverviewScreen } from "../../features/overview/OverviewScreen";
import { QueueScreen } from "../../features/queue/QueueScreen";
import { EscalationsScreen } from "../../features/escalations/EscalationsScreen";
import { DeliveryScreen } from "../../features/delivery/DeliveryScreen";
import { DashboardScreen } from "../../features/dashboard/DashboardScreen";
import { ComplaintsScreen } from "../../features/complaints/ComplaintsScreen";
import { ReconciliationScreen } from "../../features/reconciliation/ReconciliationScreen";
import { GoldenScreen } from "../../features/golden/GoldenScreen";
import { SeedCorrectionScreen } from "../../features/seedCorrection/SeedCorrectionScreen";
import { BenchScreen } from "../../features/bench/BenchScreen";
import { LeaderboardScreen } from "../../features/leaderboard/LeaderboardScreen";
import { BlindSeatScreen } from "../../features/blind/BlindSeatScreen";
import { BlindStatusScreen } from "../../features/blindStatus/BlindStatusScreen";
import { TemplatesScreen } from "../../features/templates/TemplatesScreen";
import { JurisdictionScreen } from "../../features/jurisdiction/JurisdictionScreen";
import { OrdersListScreen } from "../../features/ordersList/OrdersListScreen";

/**

 * The doors that now have a screen. `unbuiltScreens.ts` stays the COMPLETE door list —

 * it is what the rail and the command palette read, and deleting an entry as each

 * screen lands would make that table mean "unbuilt" in one file and "all…

 */
export const BUILT_SCREENS: Readonly<Record<string, () => JSX.Element>> = {
  "/": OverviewScreen,
  /*
   * THE QUEUE IS THE CONTRACT'S QUEUE, NOT THE DESIGN'S SCREEN 3.
   * The design draws "All Orders" at this door: a searchable, filterable,
   * paginated table with an Assigned column, a Due column, an SLA chip and a
   * per-row `Open →`. Every one of those is refused — `INVARIANTS:82-83` makes
   * the queue a single server-chosen next order with no browsing and no
   * cherry-picking, `INVARIANTS:84-85` bans the Due column and the SLA chip as
   * pace indicators, and `endpoints.ts:69`/`:77-82` records that the browse
   * endpoint was removed BY CONSTRUCTION.
   * `INVARIANTS:26-27`: a rule a design cannot satisfy is a CONFLICT IN THE
   * DESIGN — report it, do not weaken the rule. Reported in
   * `docs/frontend/design-2026-08/CONFLICT-all-orders.md`; unresolved, and
   * awaiting an owner ruling.
   */
  "/queue": QueueScreen,
  "/ingest": IngestScreen,
  /*
   * SCREEN 10, AND THE RULE THE DESIGN OMITS.
   * Design §Screens 10 draws determination buttons and a settled banner and
   * never mentions that resolution is REFUSED WITHOUT A RULE
   * (endpoints.ts:233-236, `INVARIANTS:36-38`). A transcription of the drawing
   * would settle clusters the server refuses to settle. See
   * `features/escalations/ResolveCard.tsx`.
   */
  "/escalations": EscalationsScreen,
  /*
   * SCREEN 9. The Reissue Gateway is deliberately NOT built: there is no
   * reissue endpoint and no `Report.reason`/`Report.supersedes`, so nothing
   * carries the reason design README:33 makes the gate. `DeliveryStatus` is
   * `z.string()` and explicitly OPEN (enums.ts:118), so the four receipt steps
   * cannot be named either. Both refusals render as honest gaps in place.
   */
  "/delivery": DeliveryScreen,

  /* The seven stages the server returns, drawn as a board. `LifecycleStage.count`
     is the only rendered figure — `orders.length` reaches none of them. */
  "/dashboard": DashboardScreen,

  /* The post-delivery defect loop. A resolution is refused without the rule it
     terminates in (endpoints.ts:548). */
  "/complaints": ComplaintsScreen,

  /* Blind-fifty divergences. A ruling with no source is an opinion
     (endpoints.ts:345), so the citation is a requirement, not a field. */
  "/reconciliation": ReconciliationScreen,

  /* The measured ground truth. No aggregate accuracy headline anywhere on it —
     AGENTS.md names one as an anti-pattern, not a missing feature. */
  "/golden": GoldenScreen,

  /* Correcting the ruler everything else is measured with: source + reason +
     signature, or it is refused (endpoints.ts:285). */
  "/seed-correction": SeedCorrectionScreen,

  /* Section x tag against the golden set. Two integers per cell and no
     division anywhere in the directory — a percentage would be the headline
     the anti-pattern list forbids. */
  "/bench": BenchScreen,

  /* Engines: declared capabilities, per-call cost and latency, and a seat
     change that is refused without its evidence. Never a ranking. */
  "/leaderboard": LeaderboardScreen,

  /*
   * THE CAPTURE SEAT. `rootRoute` withholds BOTH navigators here — see
   * `chrome/captureSeat.ts`. This entry only names the screen; the blindness
   * is the shell's job and stays there.
   */
  "/blind": BlindSeatScreen,

  /* The OPS read of capture, which is a different world from the seat and
     keeps its rail. Most of it has no contract surface and says so. */
  "/blind-status": BlindStatusScreen,
  "/templates": TemplatesScreen,
  "/jurisdiction": JurisdictionScreen,
  "/orders-list": OrdersListScreen,
};
