import type { JSX } from "react";
import { OverviewScreen } from "../../features/overview/OverviewScreen";
import { OrdersListScreen } from "../../features/ordersList/OrdersListScreen";
import { IngestScreen } from "../../features/ingest/IngestScreen";
import { DeliveryScreen } from "../../features/delivery/DeliveryScreen";
import { EscalationsScreen } from "../../features/escalations/EscalationsScreen";
import { TemplatesScreen } from "../../features/templates/TemplatesScreen";
import { JurisdictionScreen } from "../../features/jurisdiction/JurisdictionScreen";
import { BlindSeatScreen } from "../../features/blind/BlindSeatScreen";

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
  "/orders-list": OrdersListScreen,
  "/ingest": IngestScreen,
  "/delivery": DeliveryScreen,
  "/escalations": EscalationsScreen,
  "/templates": TemplatesScreen,
  "/jurisdiction": JurisdictionScreen,
  "/blind": BlindSeatScreen,
};
