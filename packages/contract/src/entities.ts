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
 * WHERE ON THE PAGE THE VALUE WAS READ — one box, in page-relative units.
 *
 * Was `z.unknown()` and marked OPEN until 2026-08-28. `unknown` is not a
 * deferral, it is a hole: every consumer had to cast before it could draw, so
 * the overlay drew nothing and the review screen's citation pin marked the PAGE
 * and said no coordinate was recorded — for fields that had one all along.
 *
 * ORIGIN TOP-LEFT, EVERY MEMBER NORMALIZED 0–1 against the rendered page box,
 * and the range is CHECKED rather than described. A pixel box is meaningless
 * without the raster's own dimensions, which no response carries; a fraction is
 * meaningful against whatever the client renders. `.min(0).max(1)` is not
 * validation theatre — a box outside the page is a box the overlay would draw
 * off the sheet, and a defect the boundary parser should name rather than
 * paint. `w`/`h` are extents, not a second corner, so a zero-height box is
 * impossible to confuse with a point.
 *
 * `page` rides ON THE BOX because a reading may cite a different page from the
 * field that adopted it (`FieldReading.page`), and a coordinate that had to be
 * paired with a page from elsewhere is a coordinate a caller can mis-pair.
 *
 * ONE BOX, NOT AN ARRAY. This is a LINE's box — the smallest thing an engine
 * reports a position for. A value spanning two lines has two readings behind
 * it, each with its own box; folding them into one array here would ask the
 * client to decide which of them the citation means.
 *
 * NULLABLE AT EVERY SITE THAT HOLDS ONE, and null is a real state, not a
 * placeholder: engines without coordinate output (pdftotext, a plain LLM read)
 * declare null. `null` = "this engine recorded no position". It never means
 * "position zero", which is why there is no companion `has_coords` boolean —
 * nullability already says it (`Preferences.nav_collapsed`, intake.ts).
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
 * THE EXCERPT, SPLIT AT THE MATCH — and it carries its own citation.
 *
 * `source_snippet` is the excerpt as one string, and it stays: it is what the
 * page says, verbatim, and every consumer that only needs to quote reads that.
 * What it cannot do is say WHICH SUBSTRING the engine matched, so the review
 * screen could quote the line and not show the reader what in it was read. The
 * split is the engine's own — an extractor knows the offsets it matched at, and
 * nothing else does. Recomputing it in the browser with `indexOf` would be the
 * client deciding what the engine matched, and would land on the wrong
 * occurrence the first time a word appeared twice in one line.
 *
 * `pre + hit + post` IS `source_snippet`, character for character. Two members
 * stating one excerpt is a fixture invariant, not a suggestion: a server that
 * lets them drift has published two different quotations of one line.
 *
 * `doc_id` AND `page` RIDE ON THE EXCERPT. A quotation without its source is a
 * value with no citation (principle 6), and an excerpt that had to be paired
 * with a document from its container is one a caller can pair wrongly — the
 * failure being guarded against is a snippet rendered beside another page's
 * reference. They are stated here so the quotation is self-locating.
 *
 * `note` is the RULEBOOK'S remark about this excerpt — "the statement skips
 * from 2024 to nothing; the 2023 installment is absent from the package, not
 * paid". Server-authored like `asking`/`why`, for the same reason: it is a
 * claim about what the document means, and the browser has no standing to make
 * one. `null` = the rulebook had nothing to add, which is the ordinary case.
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
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * READ FIELDS ONLY: what was ordered, over what span, in how many pages.
   * Nothing here lets a client choose a product, change a period or re-count a
   * package — the server resolves all three from the client's product config.
   *
   * The delivered screen printed all three as private constants because no
   * wire carried them, and the app's fixtures said "38 pages" where the design
   * says 64 — a number nothing validated because nothing owned it.
   *
   * Nullable: an order that failed validation has no resolved product, and a
   * package nobody could read has no page count. `null` is that statement. `0`
   * would be a count, and a count asserts somebody looked.
   *
   * `period_label`, not `period`, matching `OrderSignoffResponse.period_label`
   * and `OrderCompletenessResponse.period_label` — it is a rendered label the
   * server composes from the product's derivation rule, never a machine-
   * readable span the client could recompute a date from.
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
  /**
   * Set when a reviewer suppressed this row with a reason — rulebook R13,
   * "canceled/satisfied/vacated/released/duplicates suppress with reason".
   *
   * ORTHOGONAL TO `state`, not a member of it. A judgment hit that is not
   * against our owner may already have been confirmed or corrected before
   * anybody noticed the party was wrong; folding suppression into the state
   * machine would lose that history and force every consumer to re-handle an
   * enum it has already exhausted.
   *
   * The reason is required at the endpoint, and it is the whole point: an
   * excluded row is GONE from the delivered sheet, so the record of why is the
   * only thing anybody can audit afterwards. A silent suppression is
   * indistinguishable from a miss.
   */
  excluded_reason: z.string().nullable().optional(),
  /**
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * READ FIELDS ONLY, and the only two on this schema written for a person
   * rather than for a machine.
   *
   * `asking` is the QUESTION the decision card leads with — "Is the vested
   * owner MARIA L. ESTRADA or MARIA I. ESTRADA?". `why` is why it is being
   * asked — "Two independent readers disagreed on the middle initial". The
   * design carries both on every decision (`TitlePipe.dc.html:2386-2392`,
   * rendered at `:874`); the review screen shows a field path and two values
   * and leaves the reviewer to reconstruct them, which is work the pipeline is
   * supposed to have already done.
   *
   * SERVER-AUTHORED, and that is the constraint rather than a convenience.
   * Composing either in the browser would be the UI narrating why the pipeline
   * routed something — a claim only the router can make, and one that would
   * drift from the router the moment either changed.
   *
   * Optional AND nullable, following `excluded_reason` above: ABSENT on a field
   * that never went to review, `null` on one that did and has no authored
   * question yet. Under `exactOptionalPropertyTypes` a reader gets
   * `string | null | undefined` and must handle all three, because they are
   * three different statements.
   */
  asking: z.string().nullable().optional(),
  why: z.string().nullable().optional(),
  /**
   * WHAT FOLLOWS FROM GETTING THIS ONE WRONG — "an unpaid prior-year
   * installment survives closing as a lien against the parcel."
   *
   * The third member written for a person, and it joins `asking`/`why` because
   * it answers the third question a reviewer has: what is being asked, why it
   * is being asked, and what it costs to answer it badly. The design prints it
   * as the amber line under an open decision (`isReview`'s `openConsequence`).
   *
   * SERVER-AUTHORED, and that is the constraint rather than a convenience. A
   * consequence is a claim about EXPOSURE — the rulebook's judgement about what
   * a wrong answer does to the policy — and the browser composing one would be
   * the UI inventing legal exposure from a field path. The design's own copy
   * makes the point: the sentences differ per field in ways nothing on the wire
   * predicts, because they come out of the rulebook, not out of the path.
   *
   * Optional AND nullable, exactly as `asking`/`why` above and for the same
   * three-way reason. ABSENT on a field that never went to review — no decision
   * was ever put, so there is nothing a wrong answer would cost. `null` on one
   * that did and for which the rulebook has authored no consequence yet, which
   * is the ordinary state of a newly routed field. A string is the claim.
   *
   * NOT DERIVED FROM `rule_refs`, and deliberately not. A T1 tag says the
   * exposure is ruinous; it does not say what the exposure IS, and a client
   * mapping tag → sentence would be a consequence table living in a component.
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
   * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`.
   * The reference app's QC & Escalations detail draws four evidence surfaces
   * this schema refused to carry, so they are added — every one SERVER-
   * AUTHORED, because each is a claim about the record that the browser has
   * no standing to make (principle 6):
   *
   * - `raised_by` — who escalated ("D. Okafor · Judgments & Liens").
   * - `age` — the FINISHED age label the queue chip draws ("3h ago",
   *   "settled"). A label, never a timestamp: the client must not tick.
   * - `context` — the "Extraction Context & Legal Evidence" paragraph.
   * - `excerpt` — the docket excerpt on paper, split at the boxed match,
   *   reusing `SourceExcerpt` so it is self-locating (doc + page).
   * - `identity` — the debtor-vs-owner comparison grid, both columns quoted
   *   from the record. Inventing either name is the failure this product
   *   exists to prevent; serving them is how the grid can exist at all.
   * - `qc_owner` — who the determination sits with ("R. Menon"), for the
   *   read-only hint the reference draws on non-QC seats.
   *
   * All nullable: an escalation raised without evidence attached is an
   * ordinary state, and null is its statement.
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
  /**
   * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`.
   * The version ledger the reference draws states, ON THE ROW, which version
   * a reissue superseded and the reason it stated ("Superseded · retained",
   * "Reason: …"). `ReissueRequest.reason` was accepted and echoed once but
   * never persisted, so a reloaded ledger could not say why v2 exists.
   * `supersedes` is the version number this report replaced; `reason` is the
   * reissue's stated reason. Both null on a v1 that supersedes nothing.
   */
  supersedes: z.number().int().nullable(),
  reason: z.string().nullable(),
});
export type Report = z.infer<typeof Report>;

/**
 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`.
 * One row of the Transmission Receipt the reference draws: a named step of
 * the delivery act with the server's own instant and attribution line. The
 * four canonical steps are signed → digest recorded → transmitted →
 * acknowledged; a step that has not happened yet carries `done: false` and a
 * null instant. The client renders the list verbatim — it never derives a
 * step from `status`.
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
  /** The Transmission Receipt's rows, in the server's order (RULED 2026-08-29). */
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
