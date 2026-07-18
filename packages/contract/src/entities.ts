import { z } from "zod";
import {
  BlindConfidence,
  DeliveryStatus,
  EngineKind,
  FieldState,
  GoldenTag,
  HowItGotThrough,
  NaReason,
  OrderStatus,
  RuleOrigin,
  RuleStatus,
  TypistSeat,
} from "./enums.js";

/**
 * NOTE ON OMISSIONS — deliberate, not gaps:
 * - No Probe schema. Probes are never visible in any client (CONTEXT §14).
 *   They must not exist in the contract a screen could consume.
 * - No per-reviewer throughput shape anywhere. That data does not exist in the
 *   system, so no schema may make room for it.
 */

/**
 * Line-coordinate payload for click-to-source. Exact shape is fixed when the
 * LLMWhisperer adapter lands (P2); consumed only by the PDF overlay component.
 * Engines without coordinates declare null — never a faked placeholder box.
 */
export const LineCoords = z.unknown();
export type LineCoords = z.infer<typeof LineCoords>;

export const Order = z.object({
  id: z.string(),
  client_id: z.string(),
  external_ref: z.string(),
  jurisdiction: z.string(),
  state: z.string(),
  county: z.string(),
  status: OrderStatus,
  arrived_at: z.string(),
  accepted_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
});
export type Order = z.infer<typeof Order>;

/** Per-engine reading, pre-merge. Kept permanently so disagreements stay inspectable. */
export const FieldReading = z.object({
  id: z.string(),
  field_id: z.string(),
  engine_id: z.string(),
  value: z.string().nullable(),
  page: z.number().int().nullable(),
  snippet: z.string().nullable(),
  /** Raw, unverified, documented-miscalibrated. Prioritization signal only — never a gate. */
  confidence_raw: z.number().nullable(),
  cost_usd: z.number(),
  latency_ms: z.number(),
  line_coords: LineCoords.nullable(),
});
export type FieldReading = z.infer<typeof FieldReading>;

/**
 * The provenance envelope is the product (principle 6). A field whose value is
 * non-null but whose source_* members are null is the exact failure shape the
 * architecture exists to catch — the server routes it to review; the UI renders
 * what it is given and derives nothing.
 */
export const Field = z.object({
  id: z.string(),
  order_id: z.string(),
  path: z.string(),
  value: z.string().nullable(),
  na_reason: NaReason.nullable(),
  state: FieldState,
  source_doc_id: z.string().nullable(),
  source_page: z.number().int().nullable(),
  source_snippet: z.string().nullable(),
  source_line_coords: LineCoords.nullable(),
  engine_id: z.string().nullable(),
  engine_confidence_raw: z.number().nullable(),
  rule_refs: z.array(z.string()),
  approved_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  /** All engines' pre-merge values; review UI shows A and B side by side. */
  readings: z.array(FieldReading).optional(),
});
export type Field = z.infer<typeof Field>;

export const Rule = z.object({
  id: z.string(),
  code: z.string(),
  text: z.string(),
  origin: RuleOrigin,
  status: RuleStatus,
  jurisdiction_scope: z.string().nullable(),
  version: z.number().int(),
  confirmed_by: z.string().nullable(),
  source_doc_ref: z.string().nullable(),
});
export type Rule = z.infer<typeof Rule>;

export const Escalation = z.object({
  id: z.string(),
  field_path_cluster: z.string(),
  order_ids: z.array(z.string()),
  question: z.string(),
  resolution: z.string().nullable(),
  rule_id: z.string().nullable(),
  resolved_by: z.string().nullable(),
});
export type Escalation = z.infer<typeof Escalation>;

/** Bugs are broken INPUTS routed to developers — not corrections (CONTEXT §6). */
export const Bug = z.object({
  id: z.string(),
  order_id: z.string(),
  field_id: z.string().nullable(),
  description: z.string(),
  upstream_source: z.string().nullable(),
  status: z.string(),
});
export type Bug = z.infer<typeof Bug>;

export const GoldenField = z.object({
  id: z.string(),
  order_id: z.string(),
  path: z.string(),
  value: z.string().nullable(),
  tag: GoldenTag,
  source_citation: z.string().nullable(),
  corrected_from: z.string().nullable(),
  corrected_by: z.string().nullable(),
  corrected_at: z.string().nullable(),
  correction_reason: z.string().nullable(),
});
export type GoldenField = z.infer<typeof GoldenField>;

export const Reconciliation = z.object({
  id: z.string(),
  order_id: z.string(),
  path: z.string(),
  value_a: z.string().nullable(),
  value_b: z.string().nullable(),
  ruling_value: z.string().nullable(),
  citation: z.string().nullable(),
  reason: z.string().nullable(),
  ruled_by: z.string().nullable(),
  general_rule_id: z.string().nullable(),
});
export type Reconciliation = z.infer<typeof Reconciliation>;

export const Report = z.object({
  id: z.string(),
  order_id: z.string(),
  version: z.number().int(),
  shape: z.string(),
  rendered_at: z.string(),
});
export type Report = z.infer<typeof Report>;

/** A failed delivery is a transit state — retryable, never a quality state. */
export const Delivery = z.object({
  id: z.string(),
  report_id: z.string(),
  method: z.string(),
  status: DeliveryStatus,
  attempted_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  evidence: z.string().nullable(),
});
export type Delivery = z.infer<typeof Delivery>;

export const Complaint = z.object({
  id: z.string(),
  order_id: z.string(),
  field_path: z.string(),
  shipped_value: z.string().nullable(),
  client_value: z.string().nullable(),
  how_it_got_through: HowItGotThrough,
  resolution: z.string().nullable(),
  rule_id: z.string().nullable(),
  golden_offer_accepted: z.boolean().nullable(),
});
export type Complaint = z.infer<typeof Complaint>;

export const Engine = z.object({
  id: z.string(),
  kind: EngineKind,
  enabled: z.boolean(),
  adapter_version: z.string(),
});
export type Engine = z.infer<typeof Engine>;

/** Routing is per jurisdiction × section cell; every change is human-approved with evidence. */
export const EngineRoutingCell = z.object({
  id: z.string(),
  jurisdiction: z.string(),
  section: z.string(),
  seat: z.string(),
  engine_id: z.string(),
  approved_by: z.string(),
  approved_at: z.string(),
  evidence_url: z.string(),
});
export type EngineRoutingCell = z.infer<typeof EngineRoutingCell>;

/**
 * One Leaderboard cell. `no_truth_yet` renders as NO TRUTH YET — a cell below
 * golden coverage threshold shows no number at all. There is deliberately no
 * aggregate/headline accuracy schema in this contract.
 */
export const LeaderboardCell = z.object({
  engine_id: z.string(),
  section: z.string(),
  jurisdiction: z.string(),
  no_truth_yet: z.boolean(),
  accuracy_by_tag: z.record(z.string(), z.number()).nullable(),
  cost_per_1k_pages_usd: z.number().nullable(),
  p95_latency_ms: z.number().nullable(),
  golden_coverage: z.number().int().nullable(),
});
export type LeaderboardCell = z.infer<typeof LeaderboardCell>;

/** Typist capture input — the three-part contract: value + source + confidence. */
export const BlindEntryInput = z.object({
  path: z.string(),
  value: z.string().nullable(),
  na_reason: NaReason.nullable().optional(),
  source_citation: z.string().min(1),
  confidence: BlindConfidence,
});
export type BlindEntryInput = z.infer<typeof BlindEntryInput>;

export { TypistSeat };
