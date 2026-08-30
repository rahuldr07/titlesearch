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

/**
 * ⚠ AMENDED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`.
 * `jurisdiction`/`state`/`county` LEFT this request: the server resolves all
 * three from the recorded clerk stamp once the package passes optical
 * quarantine (`QuarantineResponse.resolved`, design2.ts), so the state overlay
 * can never be hand-picked wrong — the resolution recorded in
 * CONFLICT-intake-hand-typed-jurisdiction.md. `product` ARRIVED with the same
 * ruling: intake picks it, and the effective checklist resolves by
 * client + product (`EffectiveChecklist`, workspace.ts).
 */
export const CreateOrderRequest = z.object({
  client_id: z.string(),
  external_ref: z.string(),
  /** A `ConfigProduct.id` — the second half of the checklist key. */
  product: z.string(),
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

/**
 * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
 * GET /api/queue/bands — READ SHAPES ONLY, and deliberately NOT a browse
 * endpoint. None of these rows carries a way to TAKE the work: there is no
 * claim token, no assignment field, no ordering the caller can influence.
 * `/api/queue/next` remains the only hand-over, so §4.4's "no queue
 * cherry-picking" holds by construction rather than by the screen's restraint.
 *
 * Mine is work already assigned to the caller; Held is work that stopped; In
 * flight is a senior/ops read; Recently delivered is history.
 *
 * `count` is the SERVER'S census and is NOT `orders.length`. The row list is
 * scoped to what the caller may open; the census is not. A count that shrank
 * with your permissions would read as work disappearing rather than as work
 * you are not allowed to look at — the same rule `LifecycleStage.count`
 * already states, and the reason neither may be re-derived in a browser
 * (hard rule 3). It is a count of what is left, never a rate: there is no
 * per-hour, per-person or per-period figure anywhere in this shape and §4.5
 * means there never may be.
 *
 * `title` and `note` are the server's words for the same reason
 * `LifecycleStamp.label` is: a client-side `Record<QueueBandId, string>` is a
 * second copy of product copy that drifts silently from the first.
 *
 * Whether the Mine band may be DRAWN at all is open ruling Q11 — it sits
 * against "exactly one order, no list". This shape does not decide that; it
 * makes the data expressible so the ruling can be about the screen.
 */
export const QueueBandId = z.enum(["mine", "held", "in_flight", "delivered"]);
export type QueueBandId = z.infer<typeof QueueBandId>;

export const QueueBandOrder = z.object({
  id: z.string(),
  order_ref: z.string(),
  addr: z.string(),
  place: z.string(),
  /** How long it has sat. A duration already elapsed, never a countdown or a rate. */
  waited: z.string().nullable(),
  waiting_on: z.string(),
  /** The server's word for why it stopped. Null when it has not. Never an enum. */
  state_label: z.string().nullable(),
  mine: z.boolean(),
});
export type QueueBandOrder = z.infer<typeof QueueBandOrder>;

export const QueueBand = z.object({
  id: QueueBandId,
  title: z.string(),
  note: z.string(),
  /** SERVER-SUPPLIED. Never `orders.length` — see the block comment above. */
  count: z.number().int(),
  orders: z.array(QueueBandOrder),
});
export type QueueBand = z.infer<typeof QueueBand>;

/**
 * Which bands appear, and in what order, is the SERVER'S answer to "what may
 * this caller see" — a reviewer is served no `in_flight` band at all rather
 * than an empty or dimmed one. An absent band and an empty band are different
 * statements, and only the server can tell them apart.
 */
export const QueueBandsResponse = z.object({ bands: z.array(QueueBand) });
export type QueueBandsResponse = z.infer<typeof QueueBandsResponse>;

/**
 * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-31, fidelity Wave 2).
 * READ SHAPE ONLY: no endpoint accepts these, and none may be written.
 *
 * The four figures the order strip prints, DECIDED ON THE SERVER. They were
 * being computed in the browser from the `fields` array, and `no_source` was
 * the reason this shape had to exist: the strip filtered for
 * `value !== null && source_doc_id === null && source_page === null &&
 * readings.length === 0` and printed the result as a headline number. That is
 * the browser ruling on provenance — a server judgement (hard rule 3) and one
 * the screen could not cite (principle 6). A count whose definition lives in a
 * component is a count nobody can audit against the pipeline.
 *
 * NONE of these is `fields.length` or a tally of `fields[].state`, for the same
 * reason `QueueBand.count` and `LifecycleStage.count` are not `orders.length`:
 * the array is scoped to what the caller may see, the census is not. A total
 * that shrank with your permissions reads as work vanishing.
 *
 * A CENSUS, NEVER A RATE (§4.5) — how many sit here now. There is no per-hour,
 * per-person or per-period figure in this shape and there never may be.
 */
export const OrderCensus = z.object({
  fields: z.number().int(),
  auto_confirmed: z.number().int(),
  needs_review: z.number().int(),
  /** Values the pipeline produced with no document, page or reading behind them. */
  no_source: z.number().int(),
  /**
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-08-27, review workstation).
   * READ FIELDS ONLY, and they exist because the alternative was arithmetic.
   *
   * The review dock prints "12 of 18 answered · rest of the queue 17". Every
   * one of those three numbers was being computed in the browser — `settled`
   * as a filter over `fields[].state`, `decisions` as `settled + queued`, and
   * `queue_rest` as `decisions - 1` for the open one. That is the browser
   * deciding what counts as a decision, which is the same class of judgement
   * `no_source` above was moved off the client for, and it is the exact shape
   * of the `answered = base + a` bug the reference prototype shipped
   * (`derived()` in ANALYSIS-behavior §5, which AGENTS.md forbids surviving
   * into this build as authority).
   *
   * `decisions` is how many fields this order ever put in front of a person —
   * NOT `fields`, which includes the auto-confirmed nobody saw and the pending
   * nothing has read yet. `settled` is how many of those carry a ruling.
   * `queue_rest` is what remains behind the open one, and it is the server's
   * because only the server knows what else it would hand over.
   *
   * OPTIONAL for the same reason `census` itself is: absent is not zero, it is
   * "the server did not say", and the dock prints that silence rather than
   * filling it in.
   *
   * A CENSUS, NEVER A RATE (§4.5). Nothing here is per-hour or per-person, and
   * §4.5 means nothing here ever may be.
   */
  decisions: z.number().int().optional(),
  settled: z.number().int().optional(),
  queue_rest: z.number().int().optional(),
  /**
   * HOW MANY OF THIS ORDER'S DECISIONS THE SERVER IS STILL WAITING ON, and it
   * is the server's figure for the same reason every other member here is.
   *
   * The design's top bar prints it as a pill ("6 fields"). It was not printed,
   * because the only way to get it was `decisions - settled` — a subtraction in
   * the browser, and the identical arithmetic `queue_rest` exists to remove one
   * line above. The two are NOT the same number and the distinction is the
   * reason both exist: `queue_rest` is how much of the queue is left to WALK
   * (settled rulings included — a reviewer moving back through one is still
   * walking the queue), `remaining` is how many still want an ANSWER.
   *
   * Nor is the subtraction reliably right. `decisions - settled` assumes every
   * decision is either settled or awaiting this reviewer, and a field parked on
   * a countersign or held behind an escalation is neither. Only the server
   * knows which of its own decisions it is still waiting on.
   *
   * OPTIONAL, like its three neighbours: absent is "the server did not say",
   * and the bar prints that silence rather than filling it in with a zero. Zero
   * is a real and different answer — nothing outstanding, the order is done.
   *
   * A CENSUS, NEVER A RATE (§4.5). How many sit here now, and nothing per-hour.
   */
  remaining: z.number().int().optional(),
  /**
   * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`.
   * THE VERDICT CARD'S CTA COPY, SERVER-CHOSEN. The reference derives "Verify
   * 6 Fields" / "Open Second Read" / "Open Publication Studio" from a
   * five-branch state read in the browser; hard rule 3 puts that machine on
   * the server, so the WORD arrives here beside the census it summarises.
   * A free string, deliberately not an enum — nothing may switch on it.
   * Optional: absent is "the server did not say", and the hub falls back to
   * naming the door rather than inventing a verdict.
   */
  verdict_action: z.string().optional(),
});
export type OrderCensus = z.infer<typeof OrderCensus>;

export const OrderFieldsResponse = z.object({
  order_id: z.string(),
  fields: z.array(Field),
  /**
   * OPTIONAL, and absent is not zero — it is "the server did not say". The
   * strip must print the silence rather than fill it in, which is the whole
   * point of moving these numbers off the client.
   */
  census: OrderCensus.optional(),
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

// ---- source pages ----------------------------------------------------------
/**
 * GET /api/orders/{id}/pages — the package's pages, as TEXT.
 *
 * A page carries the lines that were read off it, not a raster: the review
 * screen needs to show WHERE a value came from, and the recorded line
 * coordinates index into this text. `read_in_full` is server-supplied — most
 * pages of a county package carry no field the report needs, and a page nobody
 * typed is normal rather than an error.
 */
export const SourcePage = z.object({
  n: z.number().int(),
  /** Server's classification. A page not read in full is normal, not a gap. */
  read_in_full: z.boolean(),
  /** What the page is — "WARRANTY DEED", "TREASURER", used as the header. */
  kind: z.string(),
  lines: z.array(z.string()),
  /** Scan quality finding. Drives the degraded render; never inferred client-side. */
  degraded: z.boolean(),
});
export type SourcePage = z.infer<typeof SourcePage>;

/**
 * ONE RECORDED INSTRUMENT INSIDE THE PACKAGE — a boundary THE PIPELINE DREW.
 *
 * A county package is a stack of scans; the instruments in it are found by the
 * partitioning stage, which the pipeline already runs and already names
 * ("Quarantine & Document Boundary Partitioning"). This shape is that stage's
 * output reaching a screen for the first time.
 *
 * IT IS ON THE WIRE BECAUSE THE ALTERNATIVE WAS INVENTING IT. The design's
 * "Package Instrument Index" could have been built by grouping runs of equal
 * `SourcePage.kind` — and that would have drawn document boundaries the
 * pipeline never drew. Two consecutive deeds would have merged into one
 * instrument; a deed continued on a page the classifier labelled differently
 * would have split into two. A boundary is a finding, not a `groupBy`.
 *
 * `first_page`/`last_page` are INCLUSIVE and both are the server's. The design
 * derives its own highlight from a `next` cursor; a half-open range would have
 * the client subtract one to render the label, which is arithmetic about a
 * document's extent that the partitioner already did.
 *
 * `recorded_ref` is the instrument's reference OF RECORD — a book/page or an
 * instrument number. `null` where the package holds no index entry for it (a
 * plat cover sheet, an unrecorded affidavit), which is a real and ordinary
 * state, not a missing lookup.
 */
export const PackageInstrument = z.object({
  id: z.string(),
  /** The instrument as the recorder's index names it. Server-authored. */
  label: z.string(),
  /** The partitioner's classification — "deed", "security_deed", "judgment". */
  kind: z.string(),
  first_page: z.number().int(),
  last_page: z.number().int(),
  recorded_ref: z.string().nullable(),
});
export type PackageInstrument = z.infer<typeof PackageInstrument>;

/**
 * `instruments` is REQUIRED, unlike the optional censuses elsewhere in this
 * file, because a package that reached this endpoint has been through
 * partitioning by definition — the stage runs before extraction, so there is
 * always an answer. An EMPTY array is that answer for a package the partitioner
 * found no boundary in (a single-instrument bringdown, a package it could not
 * segment), and the screen says so rather than drawing an empty list.
 */
export const OrderPagesResponse = z.object({
  order_id: z.string(),
  total_pages: z.number().int(),
  pages: z.array(SourcePage),
  instruments: z.array(PackageInstrument),
});
export type OrderPagesResponse = z.infer<typeof OrderPagesResponse>;

/**
 * POST /api/fields/{id}/exclude — suppress a row WITH its reason (R13).
 *
 * The reason is required for the same argument as a correction's: a suppressed
 * row is invisible on the delivered sheet, so the record of why it went is the
 * only thing anybody can audit later. A silent suppression is indistinguishable
 * from a miss.
 */
export const ExcludeFieldRequest = z.object({
  reason: z.string().min(1),
});
export type ExcludeFieldRequest = z.infer<typeof ExcludeFieldRequest>;
