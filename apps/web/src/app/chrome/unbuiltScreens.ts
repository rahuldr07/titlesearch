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
    binds:
      "LifecycleResponse (intake.ts:246) · OrdersPageResponse (design.ts) for the recent rows",
    missing:
      "BUILT (features/overview). The recent-orders table arrived with GET /api/orders, which the 2026-08-28 ruling added; the server owns the page and its total, so nothing here is counted in the browser. Still absent for want of a shape: the stat-card note line (LifecycleResponse carries no note per figure) and the spotlight's SLA chip and assignee (no member on Order).",
  },
  {
    path: "/ingest",
    screen: "Intake",
    binds:
      "CreateOrderRequest (endpoints.ts:39) · IngestRejection (:49) · POST /api/orders/{id}/accept (:60) · QuarantineResponse (design2.ts:35) — GET /api/orders/{id}/quarantine",
    missing:
      "BUILT (features/ingest), quarantine included. The Quarantine Gateway checklist and the Optical Profile card render from GET /api/orders/{id}/quarantine (design2.ts:35-42, added under the 2026-08-28 ruling): every step state and every optical verdict is the server's, and the sha256 renders as data. Still absent for want of a member: product on CreateOrderRequest (endpoints.ts:39-46) — so the checklist key is half-resolved and the banner names every checklist the client has — and a readiness member on QuarantineResponse, so the design's sign-disabled-until-ready gate stays the server's accept refusal rather than button state. Acceptance is explicit (INVARIANTS:47), so the design's single Sign button is two acts here.",
  },
  {
    path: "/delivery",
    screen: "Delivery",
    binds:
      "DeliveriesResponse (endpoints.ts:679) · DeliveryWithReport (:671) · Report (entities.ts:321) · ArtifactsResponse / ReissueRequest (design.ts)",
    missing:
      "BUILT (features/delivery; the compiler is features/release under /orders/{id}). What this entry used to name as absent arrived with the 2026-08-28 ruling: compile is GET /api/orders/{id}/composition (CompositionResponse with ManifestBlock + GateCheck, design.ts:71-102), sign-and-execute is POST /api/orders/{id}/release with release.compile/release.execute in PERMISSIONS (authz.ts:89-90), and reissue is POST /api/deliveries/{id}/reissue with delivery.reissue (authz.ts:91; design.ts:135-146). Still true: DeliveryStatus is z.string() (enums.ts:118), so the four receipt steps cannot be named and TransmissionReceipt refuses them; and Report (entities.ts:321-328) carries no reason/supersedes member, so a reloaded version ledger cannot state WHY v2 exists — ReissueResponse carries both only in the mutation's answer.",
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
      "AN ORDER. This door is order-scoped — every screen beneath it needs an id. A list endpoint now EXISTS — GET /api/orders, the 2026-08-28 ruling's Option C — and /orders-list is its door, so 'no list endpoint' is no longer the reason there is no chooser here. The reason that remains: the ruling narrowed INVARIANT 22 rather than deleting it — review hand-over stays one server-chosen order with no cherry-picking, and All Orders is a separate ops surface. The route exists because authz.ts:66 declares the door and the rail must be able to draw it; the way in is /api/queue/next handing you one, or a context-carrying deep link.",
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
