import { describeAxeForRoutes } from "../helpers/axe";

/**
 * The accessibility gate's call site. `@axe-core/playwright` shipped as a
 * devDependency with a complete helper and ZERO importers, so the invariants
 * job was green over a scan that never ran.
 *
 * The list is the door table, kept identical to `smoke/routes.spec.ts` on
 * purpose: a route that renders is a route that must also be reachable by
 * keyboard and screen reader, and one list means the two can never drift into
 * "renders but was never scanned".
 *
 * Scans the loaded state of each route only. Overlays, dialogs and expanded
 * menus are NOT covered here — axe reads the live DOM, so a closed overlay is
 * an untested overlay, and this app's dense surfaces are mostly overlays.
 * Those need per-interaction scans with `expectNoAxeViolations`.
 */
const ROUTES = [
  "/",
  "/orders-list",
  "/orders",
  "/ingest",
  "/delivery",
  "/escalations",
  "/templates",
  "/jurisdiction",
  "/account",
  "/blind",
  "/orders/ord_demo_1",
  "/orders/ord_demo_1/review",
  "/orders/ord_demo_1/release",
  "/blind/ord_demo_1",
];

describeAxeForRoutes(ROUTES);
