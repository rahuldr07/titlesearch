import type { JSX } from "react";
import { OverviewScreen } from "../../features/overview";
import { QueueScreen } from "../../features/queue";
import { OrdersListScreen } from "../../features/ordersList";
import { IngestScreen } from "../../features/ingest";
import { EscalationsScreen } from "../../features/escalations";
import { TemplatesScreen } from "../../features/templates";
import { JurisdictionScreen } from "../../features/jurisdiction";
import { BlindSeatScreen } from "../../features/blind";

/**
 * The flat doors that have a screen. `unbuiltScreens.ts` stays the complete
 * door list — the rail and the palette read it — and this map names the ones
 * that have arrived. A path here that is not in that table renders nowhere.
 *
 * The order-scoped routes (`/orders/{id}`, `/orders/{id}/review`,
 * `/orders/{id}/release`) are hand-wired in `orderRoutes.tsx`, which is what
 * makes a misspelled param a compile error.
 */
export const BUILT_SCREENS: Readonly<Record<string, () => JSX.Element>> = {
  "/": OverviewScreen,
  "/queue": QueueScreen,
  "/orders-list": OrdersListScreen,
  "/ingest": IngestScreen,
  "/escalations": EscalationsScreen,
  "/templates": TemplatesScreen,
  "/jurisdiction": JurisdictionScreen,
  "/blind": BlindSeatScreen,
};
