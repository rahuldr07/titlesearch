import { z } from "zod";
import { ROLES } from "./authz.js";
import { GoldenTag } from "./enums.js";
import {
  Bug,
  Complaint,
  Delivery,
  Engine,
  EngineRoutingCell,
  Escalation,
  Field,
  GoldenField,
  LeaderboardCell,
  Order,
  Reconciliation,
  Report,
  Rule,
  BlindEntryInput,
} from "./entities.js";

/**
 * Request/response schemas for the REST contract (CONTEXT §7). The refusals
 * encoded here are product requirements, not validation niceties — each one is
 * also a release gate (CONTEXT §18) and becomes a Playwright test. The server
 * re-enforces every one of them; these schemas exist so the UI and MSW mocks
 * cannot drift from them.
 */

/**
 * Minimal mutation acknowledgement. Confirm/correct/escalate/bug responses
 * carry no state back — the client re-reads its list query; the server stays
 * the only author of field state.
 */
export const Ack = z.object({ ok: z.literal(true) });
export type Ack = z.infer<typeof Ack>;

// ---- ingest ----------------------------------------------------------------

export const CreateOrderRequest = z.object({
  client_id: z.string(),
  external_ref: z.string(),
  jurisdiction: z.string(),
  state: z.string(),
  county: z.string(),
});
export type CreateOrderRequest = z.infer<typeof CreateOrderRequest>;

/** An incomplete package is rejected naming the missing fields — never silently. */
export const IngestRejection = z.object({
  rejected: z.literal(true),
  missing_fields: z.array(z.string()),
  reason: z.string(),
});
export type IngestRejection = z.infer<typeof IngestRejection>;

/**
 * POST /api/orders (multipart: CreateOrderRequest fields + `package` file) —
 * success shape. Provisional minimal shape (order only) until the FastAPI
 * port fixes it; duplicates surface as 409 with the server's message, and
 * acceptance stays a separate, explicit POST /api/orders/{id}/accept.
 */
export const CreateOrderResponse = z.object({
  order: Order,
});
export type CreateOrderResponse = z.infer<typeof CreateOrderResponse>;

// ---- queue / review --------------------------------------------------------

/** GET /api/queue/next — server-ordered; there is no browse/pick endpoint. */
export const QueueNextResponse = z.object({
  order: Order.nullable(),
});
export type QueueNextResponse = z.infer<typeof QueueNextResponse>;

export const OrderFieldsResponse = z.object({
  order_id: z.string(),
  fields: z.array(Field),
});
export type OrderFieldsResponse = z.infer<typeof OrderFieldsResponse>;

/**
 * POST /api/fields/{id}/confirm — idempotent (bug-5 semantics): same value
 * resubmitted = 200; different value = 409 with message; terminal state = 409.
 * The value is sent so the server can make that comparison.
 */
export const ConfirmFieldRequest = z.object({
  value: z.string().nullable(),
});
export type ConfirmFieldRequest = z.infer<typeof ConfirmFieldRequest>;

/** POST /api/fields/{id}/correct — a correction without a reason is refused. */
export const CorrectFieldRequest = z.object({
  value: z.string().nullable(),
  na_reason: z.string().nullable().optional(),
  reason: z.string().min(1),
});
export type CorrectFieldRequest = z.infer<typeof CorrectFieldRequest>;

/** POST /api/fields/{id}/escalate — an escalation without a question is refused. */
export const EscalateFieldRequest = z.object({
  question: z.string().min(1),
});
export type EscalateFieldRequest = z.infer<typeof EscalateFieldRequest>;

/**
 * POST /api/orders/{id}/pass — CONTEXT §7: pass is recorded against the order;
 * the 4th pass auto-escalates SERVER-side (the UI just calls and moves on).
 * A pass without a one-line reason is refused. Response is a minimal ack —
 * pass counts and escalation triggers never come back to the client.
 */
export const PassOrderRequest = z.object({
  reason: z.string().min(1),
});
export type PassOrderRequest = z.infer<typeof PassOrderRequest>;

export const PassOrderResponse = z.object({
  ok: z.literal(true),
});
export type PassOrderResponse = z.infer<typeof PassOrderResponse>;

/** POST /api/bugs — broken-input channel, routes to developers. NOT corrections. */
export const CreateBugRequest = z.object({
  order_id: z.string(),
  field_id: z.string().nullable().optional(),
  description: z.string().min(1),
  upstream_source: z.string().optional(),
});
export type CreateBugRequest = z.infer<typeof CreateBugRequest>;

// ---- escalations / rules ---------------------------------------------------

/**
 * POST /api/escalations/{id}/resolve — REFUSED without a rule. The rule is not
 * optional metadata; it is the resolution. Either cite an existing rule or
 * draft one (which lands PENDING and cannot affect the pipeline until an
 * engineer confirms it).
 */
export const ResolveEscalationRequest = z.object({
  ruling: z.string().min(1),
  rule: z.union([
    z.object({ rule_id: z.string() }),
    z.object({
      draft: z.object({
        text: z.string().min(1),
        jurisdiction_scope: z.string().nullable().optional(),
      }),
    }),
  ]),
});
export type ResolveEscalationRequest = z.infer<typeof ResolveEscalationRequest>;

// ---- golden ----------------------------------------------------------------

/**
 * POST /api/golden/corrections — source + reason, permanently logged and
 * signed. The signer is derived server-side from the authenticated session,
 * never declared by the client — a browser must not decide who signed a change
 * to ground truth (that would be forgeable). The request carries the evidence
 * (value + citation + reason); the server stamps the actor.
 */
export const GoldenCorrectionRequest = z.object({
  golden_field_id: z.string(),
  corrected_value: z.string().nullable(),
  source_citation: z.string().min(1),
  reason: z.string().min(1),
});
export type GoldenCorrectionRequest = z.infer<typeof GoldenCorrectionRequest>;

/**
 * The other two seed actions (SeedCorrection §4.9 — "three actions, nothing
 * else"). Both leave the VALUE untouched and both are permanent, signed, and
 * reasoned — this is the one screen where ground truth changes:
 *   POST /api/golden/{id}/confirm — the seed is right; the model failure is
 *     real. Tag upgrades to `ruled` (now human-verified, not merely typed).
 *   POST /api/golden/{id}/demote  — the document is ambiguous; neither value
 *     can be confirmed. Tag → `suspect` (a diagnosis, PRD §12).
 * The field id travels in the URL, not the body. Refused without a reason;
 * the action is still signed, but by the server-derived session identity (an
 * unsigned change to ground truth is the failure the corpus exists to prevent,
 * and a client-declared signer would be forgeable).
 */
export const GoldenAffirmRequest = z.object({
  reason: z.string().min(1),
});
export type GoldenAffirmRequest = z.infer<typeof GoldenAffirmRequest>;

// ---- blind fifty -----------------------------------------------------------

/**
 * POST /api/blind/{order}/entries — the response is deliberately minimal.
 * This endpoint physically cannot return model output or the other seat's
 * entries; blindness is enforced server-side and verified by a security test,
 * not a UI test. Widening this response shape is a design defect.
 */
export const BlindEntriesRequest = z.object({
  entries: z.array(BlindEntryInput).min(1),
});
export type BlindEntriesRequest = z.infer<typeof BlindEntriesRequest>;

export const BlindEntriesResponse = z.object({
  accepted: z.literal(true),
  entry_ids: z.array(z.string()),
});
export type BlindEntriesResponse = z.infer<typeof BlindEntriesResponse>;

// ---- reconciliation --------------------------------------------------------

export const ReconciliationResponse = z.object({
  order_id: z.string(),
  divergences: z.array(Reconciliation),
});
export type ReconciliationResponse = z.infer<typeof ReconciliationResponse>;

/**
 * POST /api/reconciliation/{order} — a ruling with no source is an opinion.
 * Citation is required. A general rule may be offered by the senior (never
 * pre-selected by the UI) and lands PENDING.
 */
export const ReconciliationRulingRequest = z.object({
  path: z.string(),
  ruling_value: z.string().nullable(),
  citation: z.string().min(1),
  reason: z.string().optional(),
  general_rule_draft: z
    .object({
      text: z.string().min(1),
      jurisdiction_scope: z.string().nullable().optional(),
    })
    .optional(),
});
export type ReconciliationRulingRequest = z.infer<typeof ReconciliationRulingRequest>;

// ---- bench -----------------------------------------------------------------

/**
 * GET /api/bench/results — section × tag matrix vs the golden set
 * (CONTEXT §7). The two axes are the finding; there is deliberately NO
 * aggregate number in this shape. ORDER_SUPPLIED fields are absent from
 * every denominator server-side.
 */
export const BenchCell = z.object({
  section: z.string(),
  tag: GoldenTag,
  fields: z.number().int(),
  passed: z.number().int(),
});
export type BenchCell = z.infer<typeof BenchCell>;

export const BenchFailRow = z.object({
  path: z.string(),
  tag: GoldenTag,
  model_value: z.string().nullable(),
  seed_value: z.string().nullable(),
  source_note: z.string().nullable(),
  /** Link into seed correction when the seed itself is investigable. */
  golden_field_id: z.string().nullable(),
});
export type BenchFailRow = z.infer<typeof BenchFailRow>;

export const BenchSection = z.object({
  section: z.string(),
  n: z.number().int(),
  passed: z.number().int(),
  suspect_note: z.string().nullable(),
  note: z.string().nullable(),
  fails: z.array(BenchFailRow),
});
export type BenchSection = z.infer<typeof BenchSection>;

export const BenchResultsResponse = z.object({
  run_ref: z.string(),
  seed_version: z.string(),
  total_fields: z.number().int(),
  orders: z.number().int(),
  cells: z.array(BenchCell),
  sections: z.array(BenchSection),
});
export type BenchResultsResponse = z.infer<typeof BenchResultsResponse>;

// ---- engines ---------------------------------------------------------------

export const LeaderboardResponse = z.object({
  cells: z.array(LeaderboardCell),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponse>;

/** POST /api/engines/routing — engineer-approved seat change, evidence required. */
export const EngineRoutingRequest = z.object({
  jurisdiction: z.string(),
  section: z.string(),
  seat: z.string(),
  engine_id: z.string(),
  evidence_url: z.string().min(1),
});
export type EngineRoutingRequest = z.infer<typeof EngineRoutingRequest>;

// ---- metrics ---------------------------------------------------------------

/**
 * GET /api/metrics — paired signals, catch_rate (the dashboard headline),
 * field backlog. Shape finalizes when the Flask port lands; two things are
 * contractual now: there is NO aggregate accuracy number and NO per-reviewer
 * throughput. Fields for either must never be added here. Probes surface as
 * aggregate counts ONLY — no probe detail shape may ever exist client-side.
 */
export const MetricsSourceRate = z.object({
  source: z.string(),
  correction_rate: z.number(),
  n: z.number().int(),
  /** Server-flagged alarm (e.g. text_layer corrections are bugs, derived should be impossible). */
  alarm: z.boolean(),
  note: z.string().nullable(),
});
export type MetricsSourceRate = z.infer<typeof MetricsSourceRate>;

export const MetricsBacklogRow = z.object({
  path: z.string(),
  correction_rate: z.number(),
  n: z.number().int(),
});
export type MetricsBacklogRow = z.infer<typeof MetricsBacklogRow>;

export const MetricsResponse = z
  .object({
    catch_rate: z.number().nullable(),
    probes_planted: z.number().int().nullable().optional(),
    probes_caught: z.number().int().nullable().optional(),
    /** Weekly history, oldest first — the trend is the server's statement. */
    catch_rate_history: z.array(z.number()).optional(),
    /** Server-owned expectation line; the UI draws it only when sent. */
    catch_rate_floor: z.number().nullable().optional(),
    correction_rate: z.number().nullable().optional(),
    fields_reviewed: z.number().int().nullable().optional(),
    corrected: z.number().int().nullable().optional(),
    median_minutes_per_order: z.number().nullable().optional(),
    auto_confirm_rate: z.number().nullable().optional(),
    auto_sample_correction_rate: z.number().nullable().optional(),
    auto_sample_n: z.number().int().nullable().optional(),
    escalations_per_100: z.number().nullable().optional(),
    escalations_per_100_history: z.array(z.number()).optional(),
    escalations_this_week: z.number().int().nullable().optional(),
    correction_by_source: z.array(MetricsSourceRate).optional(),
    field_backlog: z.array(MetricsBacklogRow).optional(),
    /**
     * Blind-fifty funnel (read-only status; CONTEXT §4 names this screen as
     * its measurement surface). Order-level ONLY — no typist speed or pace
     * data exists anywhere. Provisional home until the FastAPI port fixes
     * the shape.
     */
    blind_fifty: z
      .object({
        orders_total: z.number().int(),
        submitted_a: z.number().int(),
        submitted_b: z.number().int(),
        ready_for_reconciliation: z.number().int(),
        oldest_waiting_days: z.number().nullable(),
        reconciled: z.number().int(),
        drafts_pending: z.number().int(),
        judgment_fields_reconciled: z.number().int(),
        judgment_fields_target: z.number().int(),
        orders: z.array(
          z.object({
            order_ref: z.string(),
            jurisdiction: z.string(),
            a_submitted: z.enum(["submitted", "in_progress", "not_started"]),
            b_submitted: z.enum(["submitted", "in_progress", "not_started"]),
            reconciliation: z.string().nullable(),
            golden_line: z.string().nullable(),
            drafts: z.string().nullable(),
          }),
        ),
        section_coverage: z.array(
          z.object({
            section: z.string(),
            fields: z.number().int(),
            note: z.string().nullable(),
            warn: z.boolean(),
          }),
        ),
      })
      .optional(),
  })
  .catchall(z.unknown());
export type MetricsResponse = z.infer<typeof MetricsResponse>;

/**
 * GET /api/derived/{signal} — drill-down behind a dashboard number
 * (CONTEXT §7). The server authors the rows — "every number opens its
 * underlying fields"; the client renders them verbatim. Probe details are
 * NEVER a signal.
 */
export const DerivedSignalResponse = z.object({
  signal: z.string(),
  title: z.string(),
  note: z.string().nullable(),
  rows: z.array(
    z.object({
      head: z.string(),
      body: z.string(),
      meta: z.string().nullable(),
      order_id: z.string().nullable(),
    }),
  ),
});
export type DerivedSignalResponse = z.infer<typeof DerivedSignalResponse>;

// ---- complaints ------------------------------------------------------------

export const CreateComplaintRequest = z.object({
  order_id: z.string(),
  field_path: z.string(),
  client_value: z.string().nullable().optional(),
  description: z.string().optional(),
});
export type CreateComplaintRequest = z.infer<typeof CreateComplaintRequest>;

/**
 * POST /api/complaints/{id}/resolve — the complaint loop terminates in a rule
 * (principle 3: escalations, reconciliation, AND complaints all produce a
 * rulebook entry; PRD §12: resolution = fix + rule + free golden-case offer).
 * REFUSED without a rule, exactly like escalation resolution — cite an
 * existing rule or draft one, which lands PENDING (origin: complaint) and
 * cannot affect the pipeline until an engineer confirms it. The golden-case
 * offer is optional: a complaint that becomes a permanent test case is the
 * strongest fix, but not every one earns it.
 */
export const ResolveComplaintRequest = z.object({
  resolution: z.string().min(1),
  rule: z.union([
    z.object({ rule_id: z.string() }),
    z.object({
      draft: z.object({
        text: z.string().min(1),
        jurisdiction_scope: z.string().nullable().optional(),
      }),
    }),
  ]),
  golden_offer_accepted: z.boolean().optional(),
});
export type ResolveComplaintRequest = z.infer<typeof ResolveComplaintRequest>;

// ---- audit -----------------------------------------------------------------

/**
 * GET /api/audit — the append-only view (CONTEXT §6 audit_log). Read-only by
 * construction: there is no write endpoint in this contract, ever.
 */
export const AuditEntry = z.object({
  id: z.string(),
  actor_id: z.string(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string(),
  at: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const AuditResponse = z.object({ entries: z.array(AuditEntry) });
export type AuditResponse = z.infer<typeof AuditResponse>;

// ---- order timeline --------------------------------------------------------

/**
 * GET /api/orders/{id}/timeline — the order's spine: its thread through the
 * pipeline (arrived, accepted, extracted, review touches, escalations,
 * delivery versions, complaints). Server-authored; `kind` vocabulary stays
 * open until the FastAPI port owns it. Feeds the StatusRail on any screen
 * showing the order. Never carries per-person pace data.
 */
export const OrderTimelineEvent = z.object({
  at: z.string(),
  kind: z.string(),
  label: z.string(),
  detail: z.string().nullable(),
  attend: z.boolean(),
});
export type OrderTimelineEvent = z.infer<typeof OrderTimelineEvent>;

export const OrderTimelineResponse = z.object({
  order_id: z.string(),
  events: z.array(OrderTimelineEvent),
});
export type OrderTimelineResponse = z.infer<typeof OrderTimelineResponse>;

// ---- me / permissions ------------------------------------------------------

/**
 * GET /api/me/permissions — the session role's authz projection, served as
 * DATA (rules-as-data: the client renders permissions it receives, it never
 * re-derives them). The response contains ONLY the caller's grants with the
 * holder lists redacted — other roles' capabilities are unrepresented, not
 * hidden (a typist's payload does not mention other worlds). At P1 the role
 * comes from the Clerk claim; the shape does not change.
 */
export const GrantedPermissionSchema = z.object({
  action: z.string(),
  path: z.string().optional(),
  when: z
    .record(z.string(), z.array(z.string().nullable()))
    .optional(),
});
export type GrantedPermissionSchema = z.infer<typeof GrantedPermissionSchema>;

export const MePermissionsResponse = z.object({
  role: z.enum(ROLES),
  rules: z.array(GrantedPermissionSchema),
});
export type MePermissionsResponse = z.infer<typeof MePermissionsResponse>;

// ---- list responses (thin wrappers; demo data fills these via MSW) ---------

/**
 * GET /api/deliveries — each delivery embeds its report so the list can name
 * the order and version without a second round-trip (provisional shape; both
 * v1 and v2 rows appear — the pair is the defect record).
 */
export const DeliveryWithReport = Delivery.extend({ report: Report.nullable() });
export type DeliveryWithReport = z.infer<typeof DeliveryWithReport>;

export const EscalationsResponse = z.object({ escalations: z.array(Escalation) });
export const RulesResponse = z.object({ rules: z.array(Rule) });
export const GoldenResponse = z.object({ golden_fields: z.array(GoldenField) });
export const EnginesResponse = z.object({ engines: z.array(Engine) });
export const RoutingResponse = z.object({ cells: z.array(EngineRoutingCell) });
export const DeliveriesResponse = z.object({
  deliveries: z.array(DeliveryWithReport),
});
export const ComplaintsResponse = z.object({ complaints: z.array(Complaint) });
export const ReportsResponse = z.object({ reports: z.array(Report) });
export const BugsResponse = z.object({ bugs: z.array(Bug) });
