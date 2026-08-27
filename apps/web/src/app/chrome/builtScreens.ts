import type { JSX } from "react";
import { IngestScreen } from "../../features/ingest/IngestScreen";
import { OverviewScreen } from "../../features/overview/OverviewScreen";
import { QueueScreen } from "../../features/queue/QueueScreen";
import { EscalationsScreen } from "../../features/escalations/EscalationsScreen";
import { DeliveryScreen } from "../../features/delivery/DeliveryScreen";

/**
 * THE DOORS THAT NOW HAVE A SCREEN.
 *
 * `unbuiltScreens.ts` stays the COMPLETE door list — it is what the rail and
 * the command palette read, and deleting an entry as each screen lands would
 * make that table mean "unbuilt" in one file and "all doors" in another. So
 * the table keeps every path and this map names the ones that have arrived.
 *
 * A path here that is not in the table renders nowhere, and that is the right
 * failure: `packages/contract/src/authz.ts:62-81` is the frozen door list, and
 * a screen may only appear at a path that table already grants. This map can
 * replace a placeholder; it cannot open a door.
 *
 * The two order-scoped routes are NOT here. They take a path param and are
 * wired by hand in `routeTree.tsx`, which is what makes a misspelled param a
 * compile error.
 */
export const BUILT_SCREENS: Readonly<Record<string, () => JSX.Element>> = {
  "/": OverviewScreen,
  /*
   * THE QUEUE IS THE CONTRACT'S QUEUE, NOT THE DESIGN'S SCREEN 3.
   *
   * The design draws "All Orders" at this door: a searchable, filterable,
   * paginated table with an Assigned column, a Due column, an SLA chip and a
   * per-row `Open →`. Every one of those is refused — `INVARIANTS:82-83` makes
   * the queue a single server-chosen next order with no browsing and no
   * cherry-picking, `INVARIANTS:84-85` bans the Due column and the SLA chip as
   * pace indicators, and `endpoints.ts:69`/`:77-82` records that the browse
   * endpoint was removed BY CONSTRUCTION.
   *
   * `INVARIANTS:26-27`: a rule a design cannot satisfy is a CONFLICT IN THE
   * DESIGN — report it, do not weaken the rule. Reported in
   * `docs/frontend/design-2026-08/CONFLICT-all-orders.md`; unresolved, and
   * awaiting an owner ruling.
   */
  "/queue": QueueScreen,
  "/ingest": IngestScreen,
  /*
   * SCREEN 10, AND THE RULE THE DESIGN OMITS.
   *
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
};
