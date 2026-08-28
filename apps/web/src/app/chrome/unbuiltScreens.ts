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
    path: "/queue",
    screen: "Queue",
    binds: "QueueNextResponse (endpoints.ts:70) · QueueBandsResponse (endpoints.ts:136)",
    missing:
      "HARD CONFLICT, unresolved. The design draws screen 3 'All Orders' here: a searchable, filterable, paginated table with an Assigned column and a per-row 'Open →'. The contract has no browse/list/search endpoint and removed one by construction (endpoints.ts:69, :77-82); INVARIANTS:82-83 makes the queue a single server-chosen next order with no cherry-picking. Needs an owner ruling — ANALYSIS-screens.md §6.",
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
    path: "/dashboard",
    screen: "Lifecycle",
    binds: "LifecycleResponse (intake.ts:246) · LifecycleStage (intake.ts:224)",
    missing:
      "Nothing structural. Stage counts are server-authored and printed verbatim — endpoints.ts:152-156 records that a total which shrank with your permissions reads as work vanishing.",
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
    path: "/complaints",
    screen: "Complaints",
    binds:
      "ComplaintsResponse (endpoints.ts:628) · CreateComplaintRequest (:509) · HowItGotThrough (enums.ts:98)",
    missing:
      "Nothing — this screen is absent from the design entirely. The post-delivery defect loop has full contract backing and no drawing.",
  },
  {
    path: "/reconciliation",
    screen: "Reconciliation",
    binds: "ReconciliationResponse (endpoints.ts:308) · ReconciliationRulingRequest (:319)",
    missing:
      "Nothing — absent from the design, which substitutes 'T1 second read'. A ruling requires a citation: a ruling with no source is an opinion (endpoints.ts:315-318).",
  },
  {
    path: "/golden",
    screen: "Golden set",
    binds: "GoldenResponse (endpoints.ts:622) · GoldenField (entities.ts:188)",
    missing:
      "Nothing — absent from the design. The ground-truth corpus is invisible in it, and this is the one screen where ground truth changes.",
  },
  {
    path: "/seed-correction",
    screen: "Seed correction",
    binds: "GoldenCorrectionRequest (endpoints.ts:261) · GoldenAffirmRequest (:282)",
    missing:
      "Nothing — absent from the design. The signer is read-only from the session, never a typeable field (shared/session.ts).",
  },
  {
    path: "/bench",
    screen: "Bench",
    binds: "BenchResultsResponse (endpoints.ts:370) · BenchCell (:341) · BenchFailRow (:349)",
    missing:
      "Nothing — absent from the design. The shape deliberately carries no aggregate number (endpoints.ts:336-339), and AGENTS.md bans an accuracy headline.",
  },
  {
    path: "/leaderboard",
    screen: "Engines",
    binds: "LeaderboardResponse (endpoints.ts:382) · EnginesResponse (:623) · RoutingResponse (:624)",
    missing:
      "Nothing — absent from the design. Includes the no_truth_yet → NO TRUTH YET render (entities.ts:271-274).",
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
    path: "/blind-status",
    screen: "Capture status",
    binds: "ReconciliationResponse (endpoints.ts:308)",
    missing: "Nothing — absent from the design.",
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
