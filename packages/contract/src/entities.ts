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
 * Deliberate omissions, not gaps: no Probe schema (probes are never visible
 * in any client) and no per-reviewer throughput shape anywhere.
 */

/**
 * Where on the page the value was read: one line's box, origin top-left,
 * every member normalized 0-1 against the rendered page box. `page` rides on
 * the box because a reading may cite a different page from the field that
 * adopted it. A value spanning two lines has two readings, each with its own
 * box. Null at any holding site means "this engine recorded no position"
 * (pdftotext, a plain LLM read) — never "position zero".
 */
export const LineCoords = z.object({
  page: z.number().int(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});
export type LineCoords = z.infer<typeof LineCoords>;

/**
 * The excerpt split at the engine's own match offsets — never recompute the
 * split in the browser (indexOf lands on the wrong occurrence when a word
 * repeats). `pre + hit + post` must equal `source_snippet` character for
 * character. `doc_id` and `page` ride on the excerpt so the quotation is
 * self-locating. `note` is the rulebook's server-authored remark; null means
 * it had nothing to add.
 */
export const SourceExcerpt = z.object({
  doc_id: z.string(),
  page: z.number().int(),
  pre: z.string(),
  hit: z.string(),
  post: z.string(),
  note: z.string().nullable(),
});
export type SourceExcerpt = z.infer<typeof SourceExcerpt>;

export const Order = z.object({
  id: z.string(),
  client_id: z.string(),
  external_ref: z.string(),
  jurisdiction: z.string(),
  state: z.string(),
  county: z.string(),
  /**
   * Read fields only: the server resolves product, period, and page count
   * from the client's product config. Nullable — an order that failed
   * validation has no resolved product, an unreadable package has no page
   * count; `0` would assert somebody counted. `period_label` is a rendered
   * label the server composes, never a machine-readable span.
   */
  product: z.string().nullable(),
  period_label: z.string().nullable(),
  pages: z.number().int().nullable(),
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
 * The provenance envelope is the product. A field whose value is non-null but
 * whose source_* members are null is the exact failure shape the architecture
 * exists to catch — the server routes it to review; the UI renders what it is
 * given and derives nothing.
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
  /**
   * Set when a reviewer suppressed this row with a reason (rulebook R13).
   * Orthogonal to `state`, not a member of it — a row may be confirmed or
   * corrected before anyone notices it should be excluded. The reason is
   * required: an excluded row is gone from the delivered sheet, so the record
   * of why is the only thing auditable afterwards.
   */
  excluded_reason: z.string().nullable().optional(),
  /**
   * `asking` is the question the decision card leads with; `why` is why it is
   * being asked. Server-authored: composing either in the browser would be
   * the UI narrating why the pipeline routed something. Optional and
   * nullable — absent on a field that never went to review, null on one that
   * did and has no authored question yet.
   */
  asking: z.string().nullable().optional(),
  why: z.string().nullable().optional(),
  /**
   * What follows from getting this one wrong — the rulebook's claim about
   * exposure, server-authored; the browser must not invent legal exposure
   * from a field path, and it is never derived from `rule_refs`. Optional and
   * nullable with the same three-way meaning as `asking`/`why`.
   */
  consequence: z.string().nullable().optional(),
  /**
   * The excerpt split at the match, when the engine recorded its offsets.
   * ABSENT where no reader typed an excerpt; `null` where one was typed as
   * flat text and no match offsets came with it. Never reconstructed from
   * `source_snippet` — see `SourceExcerpt`.
   */
  source_excerpt: SourceExcerpt.nullable().optional(),
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
  /**
   * Evidence surfaces, every one server-authored:
   * - `raised_by` — who escalated.
   * - `age` — the finished age label ("3h ago", "settled"); a label, never a
   *   timestamp — the client must not tick.
   * - `context` — the extraction-context paragraph.
   * - `excerpt` — the docket excerpt, split at the match (`SourceExcerpt`).
   * - `identity` — the debtor-vs-owner grid, both columns quoted from the
   *   record.
   * - `qc_owner` — who the determination sits with.
   * All nullable: an escalation raised without evidence is an ordinary state.
   */
  raised_by: z.string().nullable(),
  age: z.string().nullable(),
  context: z.string().nullable(),
  excerpt: SourceExcerpt.nullable(),
  identity: z
    .object({
      debtor_label: z.string(),
      debtor: z.string(),
      owner_label: z.string(),
      owner: z.string(),
    })
    .nullable(),
  qc_owner: z.string().nullable(),
});
export type Escalation = z.infer<typeof Escalation>;

/** Bugs are broken inputs routed to developers — not corrections. */
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
  /**
   * `supersedes` is the version number this report replaced; `reason` is the
   * reissue's stated reason. Both null on a v1 that supersedes nothing.
   */
  supersedes: z.number().int().nullable(),
  reason: z.string().nullable(),
});
export type Report = z.infer<typeof Report>;

/**
 * One row of the Transmission Receipt. The four canonical steps are signed →
 * digest recorded → transmitted → acknowledged; a step that has not happened
 * yet carries `done: false` and a null instant. The client renders the list
 * verbatim — it never derives a step from `status`.
 */
export const ReceiptStep = z.object({
  id: z.string(),
  at: z.string().nullable(),
  what: z.string(),
  who: z.string(),
  done: z.boolean(),
});
export type ReceiptStep = z.infer<typeof ReceiptStep>;

/** A failed delivery is a transit state — retryable, never a quality state. */
export const Delivery = z.object({
  id: z.string(),
  report_id: z.string(),
  method: z.string(),
  status: DeliveryStatus,
  attempted_at: z.string().nullable(),
  delivered_at: z.string().nullable(),
  evidence: z.string().nullable(),
  /** The Transmission Receipt's rows, in the server's order. */
  receipt: z.array(ReceiptStep),
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
