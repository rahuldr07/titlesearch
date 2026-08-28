/**
 * What each unbuilt screen is, binds to, and lacks. A table, split out of
 * `routeTree.tsx` because that file's job is wiring.
 */
export interface ScreenDescriptor {
  readonly path: string;
  readonly screen: string;
  readonly binds: string;
  readonly missing: string;
}

export const UNBUILT_SCREENS: readonly ScreenDescriptor[] = [
  {
    path: "/",
    screen: "Overview",
    binds: "MetricsResponse (endpoints.ts:423) · LifecycleResponse (intake.ts:246)",
    missing:
      "The design's 'Recent orders table (last 10)' has no endpoint — no order-list endpoint exists, and INVARIANTS:82-83 forbids one. The stat cards bind to MetricsResponse verbatim; nothing on this screen may be counted in the browser.",
  },
  {
    path: "/ingest",
    screen: "Intake",
    binds:
      "CreateOrderRequest (endpoints.ts:39) · IngestRejection (:49) · POST /api/orders/{id}/accept (:60)",
    missing:
      "BUILT (features/ingest), minus two objects. The Quarantine Gateway checklist (AV → real-PDF → SHA-256) and the Optical Profile card (DPI, clerk stamp, contrast floor) have no schema at all — a four-step state machine and three server-owned thresholds. Both render an honest waiting-on-the-backend statement rather than a mock; backend conversation 3. Acceptance is explicit (INVARIANTS:47), so the design's single Sign button is two acts here.",
  },
  {
    path: "/delivery",
    screen: "Delivery",
    binds:
      "DeliveriesResponse (endpoints.ts:625) · DeliveryWithReport (:617) · Report (entities.ts:216)",
    missing:
      "Backend conversation 2. No compile endpoint, no gate-evaluation shape, no sign-and-execute endpoint and no release.execute action; no manifest model; no reissue endpoint and no Report.reason or Report.supersedes to carry the v2 reason. DeliveryStatus is still z.string() (enums.ts:118), so the four receipt steps cannot be named.",
  },
  {
    path: "/escalations",
    screen: "Escalations",
    binds:
      "Escalation (entities.ts:166) · ResolveEscalationRequest (endpoints.ts:238) · Rule (entities.ts:153)",
    missing:
      "Nothing structural, but the design omits the binding requirement: resolution is REFUSED without a rule (endpoints.ts:233-236, INVARIANTS:109-110), and a drafted rule lands PENDING and renders visibly inert. The design's 'determination buttons' mention neither.",
  },
  {
    path: "/blind",
    screen: "Capture seats",
    binds: "BlindEntriesRequest (endpoints.ts:295) · TypistSeat (enums.ts:69)",
    missing:
      "Nothing — an entire absent world in the design. INVARIANT 46 governs it and this shell honours it: no rail is drawn beneath /blind.",
  },
  {
    path: "/orders",
    screen: "Review",
    binds: "OrderContextResponse (intake.ts:301) · QueueNextResponse (endpoints.ts:70)",
    missing:
      "AN ORDER. This door is order-scoped — every screen beneath it needs an id, and there is deliberately no endpoint that lists orders to pick one from (endpoints.ts:69; INVARIANTS:82-83). The route exists because authz.ts:66 declares the door and the rail must be able to draw it; the way in is /api/queue/next handing you one, not a chooser here.",
  },
  {
    path: "/orders-list",
    screen: "All orders",
    binds: "OrdersPageResponse (design.ts) — GET /api/orders",
    missing: "Nothing. Added under the 2026-08-28 ruling.",
  },
  {
    path: "/templates",
    screen: "Templates",
    binds: "TemplateResponse (design2.ts) — GET /api/templates",
    missing: "No write endpoint, so the design's editor is absent rather than disabled.",
  },
  {
    path: "/jurisdiction",
    screen: "Jurisdiction",
    binds: "JurisdictionResponse (design2.ts) — GET /api/jurisdictions/{code}",
    missing: "Nothing. Added under the 2026-08-28 ruling.",
  },
  {
    path: "/account",
    screen: "Account",
    binds:
      "MeProfileResponse (intake.ts:359) · Preferences (:375) · PeopleResponse (:336) · AuditResponse (endpoints.ts:558)",
    missing:
      "BUILT (features/account), and this entry is kept because the door's gaps are worth stating. Four of the design's six panes bind to a live endpoint; Organization has no contract surface at all, and Retention is the absent half of a pane whose security half is real. The rest are REFUSALS, not gaps: the RBAC matrix cells 'cycle — / VIEW / EDIT', which implies a write, and authz.ts:118 closes PERMISSIONS with `as const satisfies` — compile-time frozen; the payload is one role's projection, so there is no fourth column to draw either. The People pane's role picker is the same refusal. Audit is read-only by construction. NOTE: an earlier version of this entry said no GET /api/me/profile handler shipped. One does, at workspace.ts:926, along with /api/people and GET+PATCH /api/me/preferences.",
  },
];
