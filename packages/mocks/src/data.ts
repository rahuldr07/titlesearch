import type {
  Complaint,
  DeliveryWithReport,
  Escalation,
  Field,
  GoldenField,
  Order,
  OrderTimelineEvent,
  Rule,
} from "@titlepipe/contract";

/**
 * Synthetic demo data migrated from the design tool's Review Screen demo,
 * scrubbed of anything resembling real NPI (frontend-master-prompt §2):
 * clearly synthetic persons/companies, DEMO-* refs. The SHAPES and the weird
 * states are preserved exactly — A/B disagreement, both NA states, a
 * degraded-scan unreadable, a pending field, and an auto-confirmed value that
 * arrived with no provenance (principle 6's failure shape, rendered flagged).
 *
 * line_coords use the minimal normalized placeholder {page,x0,y0,x1,y1}
 * consumed only by the PDF overlay (final shape lands with the LLMWhisperer
 * adapter, P2).
 */

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE ONE DEMO ORDER SET
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every endpoint that lists, counts or names an order projects THIS table:
 * `/api/queue/next`, `/api/queue/bands`, `/api/lifecycle`,
 * `/api/orders/:id/{context,signoff,pipeline,completeness}`, the timelines and
 * the deliveries store. There were two hand-maintained copies until
 * 2026-07-30 and they had already drifted — the lifecycle board and
 * `/api/queue/next` disagreed about what state 4176034-1 was in, and the
 * package ran to 38 in one place and 64 in another. A second copy of a fact is
 * a second answer.
 *
 * HOW TO USE IT (for the projection layers, `workspace.ts` / `handlers.ts`):
 *   - `demoOrders`      — every order, in no meaningful order. Filter it.
 *   - `demoOrderRow(id)`— one row, or `undefined`. Never invent a placeholder.
 *   - `demoOrderEntity` — the row as the contract's `Order`. Adding a field to
 *                         the `Order` schema edits this function and nothing else.
 *   - `demoQueue`       — the served queue, in the SERVER's order.
 *   - `PACKAGE_PAGES` / `PACKAGE_PAGES_RELEVANT` / `PRODUCT_NAME` /
 *     `PERIOD_LABEL` — the anchors. Quote them; never restate the numeral.
 *
 * WHAT IS THE EXPORT'S AND WHAT IS NOT. The refs, the package size, the
 * product, the period, the waited times, the waiting-on copy and the state
 * labels are the 2026-07-28 export's own (`TitlePipe.dc.html:3240-3258`). The
 * GEOGRAPHY is deliberately NOT: the export's addresses read like real Arizona
 * property, this file's scrubbing rule is synthetic persons and synthetic
 * places (frontend-master-prompt §2), and `demoFields` / `demoPages` below
 * describe a Clayton County GA package down to the page text. Adopting Mesa AZ
 * on the row while the pages still say CLAYTON CO. GA would be the same
 * contradiction this table exists to end.
 */
export const PACKAGE_PAGES = 64;
/**
 * Pages the classifier carried forward out of `PACKAGE_PAGES`. Quoted, never
 * restated as a numeral. Not derivable from `demoPages` below — that fixture
 * serves a SAMPLE of the package (the cited pages plus one deliberately
 * unread), so counting it would answer a different question.
 */
export const PACKAGE_PAGES_RELEVANT = 11;
export const PRODUCT_NAME = "40-Year Search";
export const PERIOD_LABEL = "40-year period · 07/18/1986 – 07/18/2026";

/** Which queue band lists an order. `null` = listed by no band. */
export type DemoBandId = "mine" | "held" | "in_flight" | "delivered";
/**
 * The overview board's columns, the export's own ids and order
 * (`TitlePipe.dc.html:3269-3277`). There is NO `failed` member: a failed order
 * is lifted into the banner, so a `failed` column could never hold a card.
 * `failed` is a flag on the row, orthogonal to where the row sits.
 */
export type DemoStageId =
  | "unassigned"
  | "intake"
  | "machine"
  | "gate"
  | "review"
  | "escalated"
  | "delivered";
export type DemoStampTone = "neutral" | "action" | "settled" | "attend" | "halt";

export interface DemoOrderRow {
  readonly id: string;
  readonly order_ref: string;
  readonly client_id: string;
  readonly jurisdiction: string;
  readonly state: string;
  readonly county: string;
  readonly status: string;
  readonly arrived_at: string;
  readonly accepted_at: string | null;
  readonly delivered_at: string | null;
  readonly product: string;
  /**
   * The rendered period label. Named `period` on the row and `period_label` on
   * the wire, the same way `order_ref` is `external_ref` on the wire — the row
   * is a fixture table, not a wire shape, and `demoOrderEntity` is the one
   * place the two names meet.
   */
  readonly period: string;
  /** Null when the package could not be read at all — never 0, which is a count. */
  readonly pages: number | null;
  /** `null` = the served next-up order, which is not a band. */
  readonly band: DemoBandId | null;
  readonly stage: DemoStageId;
  /** Server ordering for GET /api/queue/next. `null` = not in the served queue. */
  readonly queue_position: number | null;
  readonly addr: string;
  readonly place: string;
  readonly waited: string | null;
  readonly waiting_on: string;
  /**
   * The server's WORD for where this order stands, not a state-machine member.
   * A free string on purpose: an enum invites `switch (order.state)` in the
   * browser, which is the client-side state machine the hard rules put on the
   * server.
   */
  readonly state_label: string | null;
  readonly mine: boolean;
  readonly failed: boolean;
  readonly stamp_label: string;
  readonly stamp_tone: DemoStampTone;
}

type DemoOrderSpec = Omit<
  DemoOrderRow,
  "client_id" | "status" | "arrived_at" | "accepted_at" | "delivered_at"
>;

const ARRIVED = "2026-07-24T13:05:00Z";
const ACCEPTED = "2026-07-24T13:22:00Z";
const DELIVERED = "2026-07-24T17:20:00Z";

/**
 * Status and the three timestamps are DERIVED from the stage, not restated per
 * row: a fixture that lets an order be `delivered` with a null `delivered_at`
 * is the same class of self-contradiction this table exists to end.
 */
function row(spec: DemoOrderSpec): DemoOrderRow {
  const claimed = spec.stage !== "unassigned";
  const done = spec.stage === "delivered";
  // A delivery that FAILED IN TRANSIT reached nobody, so it has no
  // `delivered_at`. `4176003-4` sits at the delivered stage and is flagged
  // failed; stamping it with a delivery time would be the fixture asserting a
  // client received something that bounced.
  const arrived = done && !spec.failed;
  return {
    ...spec,
    client_id: "cli_riverbend",
    status: arrived ? "delivered" : done ? "delivery_failed" : claimed ? "accepted" : "ingested",
    arrived_at: ARRIVED,
    accepted_at: claimed ? ACCEPTED : null,
    delivered_at: arrived ? DELIVERED : null,
  };
}

export const demoOrders: readonly DemoOrderRow[] = [
  row({
    id: "ord_demo_1", order_ref: "4176034-1", queue_position: 0,
    band: "mine", stage: "gate", mine: true, failed: false,
    addr: "4152 Creekstone Dr, Demoville GA", place: "Clayton County · GA",
    jurisdiction: "clayton-ga", county: "Clayton", state: "GA",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: PACKAGE_PAGES,
    waited: "3h 12m", waiting_on: "Package incomplete", state_label: null,
    stamp_label: "Package incomplete", stamp_tone: "halt",
  }),
  row({
    id: "ord_demo_2", order_ref: "4176052-7", queue_position: 1,
    band: null, stage: "unassigned", mine: false, failed: false,
    addr: "61 Harrowgate Row, Ashford Ridge NY", place: "Greene County · NY",
    jurisdiction: "greene-ny", county: "Greene", state: "NY",
    product: "60-Year Search", period: "60-year period · 07/18/1966 – 07/18/2026", pages: 92,
    waited: null, waiting_on: "Unclaimed — nobody has taken it", state_label: null,
    stamp_label: "Sign-off open", stamp_tone: "attend",
  }),
  row({
    id: "ord_demo_4", order_ref: "4176041-6", queue_position: null,
    band: "mine", stage: "intake", mine: true, failed: false,
    addr: "18 Marlin Way, Demoville GA", place: "Clayton County · GA",
    jurisdiction: "clayton-ga", county: "Clayton", state: "GA",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: PACKAGE_PAGES,
    waited: "1h 48m", waiting_on: "Sign-off open", state_label: null,
    stamp_label: "Sign-off open", stamp_tone: "attend",
  }),
  row({
    id: "ord_demo_5", order_ref: "4176011-2", queue_position: null,
    band: "held", stage: "gate", mine: true, failed: false,
    addr: "72 Aldergate Rd, Fairhollow GA", place: "Greene County · GA",
    jurisdiction: "greene-ga", county: "Greene", state: "GA",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: 48,
    waited: "1d 4h", waiting_on: "Waiting on the abstractor to add documents",
    state_label: "Package incomplete",
    stamp_label: "Package incomplete", stamp_tone: "halt",
  }),
  row({
    id: "ord_demo_6", order_ref: "4175994-0", queue_position: null,
    band: "held", stage: "escalated", mine: true, failed: false,
    addr: "9 Pellham Ct, Warrenton GA", place: "Houston County · GA",
    jurisdiction: "houston-ga", county: "Houston", state: "GA",
    product: "20-Year Search", period: "20-year period · 07/18/2006 – 07/18/2026", pages: 36,
    waited: "6h 40m", waiting_on: "Waiting on a senior abstractor",
    state_label: "Escalated",
    stamp_label: "Escalated", stamp_tone: "attend",
  }),
  row({
    id: "ord_demo_7", order_ref: "4175998-9", queue_position: null,
    band: "held", stage: "gate", mine: false, failed: true,
    addr: "Address unreadable on cover", place: "Clayton County · GA",
    jurisdiction: "clayton-ga", county: "Clayton", state: "GA",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: null,
    waited: "2d 1h", waiting_on: "Waiting on intake to re-upload",
    state_label: "Failed validation",
    stamp_label: "Failed validation", stamp_tone: "halt",
  }),
  row({
    id: "ord_demo_8", order_ref: "4176003-4", queue_position: null,
    band: "held", stage: "delivered", mine: false, failed: true,
    addr: "231 Foxglove Row, Demoville GA", place: "Clayton County · GA",
    jurisdiction: "clayton-ga", county: "Clayton", state: "GA",
    product: "Two-Owner Search", period: "current owner + one prior owner", pages: 22,
    waited: "22m", waiting_on: "Waiting on ops", state_label: "Delivery failed",
    stamp_label: "Delivery failed", stamp_tone: "halt",
  }),
  row({
    id: "ord_demo_9", order_ref: "4176048-3", queue_position: null,
    band: "in_flight", stage: "machine", mine: false, failed: false,
    addr: "441 Kestrel Ln, Brackendale NC", place: "Mecklenburg County · NC",
    jurisdiction: "mecklenburg-nc", county: "Mecklenburg", state: "NC",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: 71,
    waited: "12m", waiting_on: "Extract fields", state_label: null,
    stamp_label: "Running", stamp_tone: "neutral",
  }),
  row({
    id: "ord_demo_10", order_ref: "4176050-1", queue_position: null,
    band: "in_flight", stage: "review", mine: false, failed: false,
    addr: "88 Larkspur Ave, Brackendale NC", place: "Mecklenburg County · NC",
    jurisdiction: "mecklenburg-nc", county: "Mecklenburg", state: "NC",
    product: "Update Search", period: "since prior effective date · 03/02/2024", pages: 18,
    waited: "48m", waiting_on: "Human QC gate", state_label: null,
    stamp_label: "Decisions open", stamp_tone: "action",
  }),
  row({
    id: "ord_demo_11", order_ref: "4176045-9", queue_position: null,
    band: "in_flight", stage: "gate", mine: false, failed: false,
    addr: "5 Windmere Ct, Fairhollow GA", place: "Greene County · GA",
    jurisdiction: "greene-ga", county: "Greene", state: "GA",
    product: "20-Year Search", period: "20-year period · 07/18/2006 – 07/18/2026", pages: 55,
    waited: "1h 05m", waiting_on: "Completeness gate", state_label: null,
    stamp_label: "Package incomplete", stamp_tone: "halt",
  }),
  row({
    id: "ord_demo_12", order_ref: "4175980-1", queue_position: null,
    band: "delivered", stage: "delivered", mine: true, failed: false,
    addr: "1740 Thistledown Rd, Demoville GA", place: "Clayton County · GA",
    jurisdiction: "clayton-ga", county: "Clayton", state: "GA",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: PACKAGE_PAGES,
    waited: "2h", waiting_on: "Delivered", state_label: null,
    stamp_label: "Finalized", stamp_tone: "settled",
  }),
  row({
    id: "ord_demo_13", order_ref: "4175972-3", queue_position: null,
    band: "delivered", stage: "delivered", mine: true, failed: false,
    addr: "27 Quillon St, Warrenton GA", place: "Houston County · GA",
    jurisdiction: "houston-ga", county: "Houston", state: "GA",
    product: "Two-Owner Search", period: "current owner + one prior owner", pages: 31,
    waited: "1d", waiting_on: "Delivered", state_label: null,
    stamp_label: "Finalized", stamp_tone: "settled",
  }),
];

export function demoOrderRow(id: string): DemoOrderRow | undefined {
  return demoOrders.find((r) => r.id === id);
}

/**
 * The same lookup for this file's own derivations, where a missing row is a
 * FIXTURE BUG rather than a runtime condition — a timeline that silently loses
 * its timestamps is how a demo starts contradicting itself again.
 */
function rowOrThrow(id: string): DemoOrderRow {
  const found = demoOrderRow(id);
  if (found === undefined) throw new Error(`no such demo order: ${id}`);
  return found;
}

/**
 * The contract entity for one row. Adding a field to `Order` edits only this.
 * Note the two renames at the wire boundary: `order_ref` → `external_ref` and
 * `period` → `period_label`.
 */
export function demoOrderEntity(row: DemoOrderRow): Order {
  return {
    id: row.id,
    client_id: row.client_id,
    external_ref: row.order_ref,
    jurisdiction: row.jurisdiction,
    state: row.state,
    county: row.county,
    product: row.product,
    period_label: row.period,
    pages: row.pages,
    status: row.status,
    arrived_at: row.arrived_at,
    accepted_at: row.accepted_at,
    delivered_at: row.delivered_at,
  };
}

/**
 * SERVER-ORDERED, and that is the whole point of `queue_position` being data:
 * the queue is not a list to shop through, so the order of service is a fact
 * the fixture states rather than an accident of array order.
 */
export const demoQueue: readonly DemoOrderRow[] = demoOrders
  .filter((r) => r.queue_position !== null)
  .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));

/** The live review order — the package `demoFields` and `demoPages` describe. */
const oid = "ord_demo_1";

export const demoFields: Field[] = [
  // ---- OWNER ---------------------------------------------------------------
  {
    id: "fld_owner",
    order_id: oid,
    path: "owner.names",
    value: "MARLOWE D. QUENBY AND TESSA R. QUENBY",
    na_reason: null,
    state: "confirmed",
    source_doc_id: "doc_deed",
    source_page: 6,
    source_snippet:
      "…unto MARLOWE D. QUENBY and TESSA R. QUENBY, as joint tenants…",
    source_line_coords: [{ page: 6, x0: 0.08, y0: 0.3, x1: 0.92, y1: 0.335 }],
    engine_id: "gemini-2.5-flash",
    engine_confidence_raw: 0.98,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  },
  {
    id: "fld_addr",
    order_id: oid,
    path: "owner.property_address",
    value: "4152 CREEKSTONE DR, DEMOVILLE, GA",
    na_reason: null,
    state: "auto_confirmed",
    source_doc_id: "doc_deed",
    source_page: 6,
    source_snippet: "…known as 4152 Creekstone Drive, Demoville, Georgia…",
    source_line_coords: [{ page: 6, x0: 0.08, y0: 0.44, x1: 0.88, y1: 0.472 }],
    engine_id: "gemini-2.5-flash",
    engine_confidence_raw: 0.97,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  },
  {
    // low-confidence OCR, readings AGREE — routed on region confidence alone
    id: "fld_zip",
    order_id: oid,
    path: "owner.zip",
    value: "30296",
    na_reason: null,
    state: "needs_review",
    source_doc_id: "doc_tax",
    source_page: 22,
    source_snippet: "DEMOVILLE GA 30296",
    source_line_coords: [{ page: 22, x0: 0.09, y0: 0.22, x1: 0.5, y1: 0.25 }],
    engine_id: "llmwhisperer-hq",
    engine_confidence_raw: 0.62,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
    // SERVER-AUTHORED question and reason, in the export's register
    // (`TitlePipe.dc.html:2386-2392`). Present on the six queued decisions and
    // ABSENT — not null — on every field that never went to review.
    asking: "Confirm the ZIP on the tax card.",
    why: "Both readers returned the same digits, but the region's OCR confidence is below the routing threshold.",
    readings: [
      {
        id: "rdg_zip_a",
        field_id: "fld_zip",
        engine_id: "gemini-2.5-flash",
        value: "30296",
        page: 22,
        snippet: "DEMOVILLE GA 30296",
        confidence_raw: 0.9,
        cost_usd: 0.0004,
        latency_ms: 1650,
        line_coords: null,
      },
      {
        id: "rdg_zip_b",
        field_id: "fld_zip",
        engine_id: "llmwhisperer-hq",
        value: "30296",
        page: 22,
        snippet: "DEMOVILLE GA 30296",
        confidence_raw: 0.62,
        cost_usd: 0.015,
        latency_ms: 3100,
        line_coords: [{ page: 22, x0: 0.09, y0: 0.22, x1: 0.5, y1: 0.25 }],
      },
    ],
  },
  // ---- LEGAL ---------------------------------------------------------------
  {
    id: "fld_lot",
    order_id: oid,
    path: "legal.lot",
    value: "18",
    na_reason: null,
    state: "confirmed",
    source_doc_id: "doc_deed",
    source_page: 7,
    source_snippet: "…all that tract being Lot 18, Block C…",
    source_line_coords: [{ page: 7, x0: 0.08, y0: 0.38, x1: 0.86, y1: 0.41 }],
    engine_id: "pdftotext",
    engine_confidence_raw: 0.99,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  },
  {
    // NOT_PRESENT: structurally absent — correct, quiet, never queued
    id: "fld_plat",
    order_id: oid,
    path: "legal.plat_book_page",
    value: null,
    na_reason: "NOT_PRESENT",
    state: "confirmed",
    source_doc_id: null,
    source_page: null,
    source_snippet: null,
    source_line_coords: null,
    engine_id: null,
    engine_confidence_raw: null,
    rule_refs: ["metes-and-bounds-no-plat"],
    approved_by: null,
    approved_at: null,
  },
  // ---- DEED ----------------------------------------------------------------
  {
    id: "fld_grantor",
    order_id: oid,
    path: "deed.grantor",
    value: "HUNTCREST BUILDERS LLC",
    na_reason: null,
    state: "confirmed",
    source_doc_id: "doc_deed",
    source_page: 6,
    source_snippet: "HUNTCREST BUILDERS LLC, Grantor, to…",
    source_line_coords: [{ page: 6, x0: 0.08, y0: 0.26, x1: 0.8, y1: 0.29 }],
    engine_id: "pdftotext",
    engine_confidence_raw: 0.98,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  },
  {
    id: "fld_dbook",
    order_id: oid,
    path: "deed.book_page",
    value: "10944 / 213",
    na_reason: null,
    state: "confirmed",
    source_doc_id: "doc_deed",
    source_page: 6,
    source_snippet: "BK 10944 PG 213",
    source_line_coords: [{ page: 6, x0: 0.08, y0: 0.06, x1: 0.5, y1: 0.09 }],
    engine_id: "pdftotext",
    engine_confidence_raw: 0.99,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  },
  {
    id: "fld_consid",
    order_id: oid,
    path: "deed.consideration",
    value: "$215,000.00",
    na_reason: null,
    state: "confirmed",
    source_doc_id: "doc_deed",
    source_page: 6,
    source_snippet: "…for the sum of $215,000.00…",
    source_line_coords: [{ page: 6, x0: 0.08, y0: 0.58, x1: 0.84, y1: 0.61 }],
    engine_id: "pdftotext",
    engine_confidence_raw: 0.97,
    rule_refs: ["R3-cons-never-from-transfer-tax"],
    approved_by: null,
    approved_at: null,
  },
  // ---- MORTGAGES -----------------------------------------------------------
  {
    // A/B disagreement, plausible-vs-garbled — the review screen's core case
    id: "fld_m1lender",
    order_id: oid,
    path: "mortgages.1.lender",
    value: null,
    na_reason: null,
    state: "needs_review",
    source_doc_id: "doc_secdeed",
    source_page: 12,
    source_snippet: null,
    source_line_coords: null,
    engine_id: null,
    engine_confidence_raw: null,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
    asking: "Is the lender SOUTHSTONE MORTGAGE LLC?",
    why: "Two independent readers disagreed — one returned zeroes where the other returned the letter O.",
    readings: [
      {
        id: "rdg_m1l_a",
        field_id: "fld_m1lender",
        engine_id: "gemini-2.5-flash",
        value: "SOUTHSTONE MORTGAGE LLC",
        page: 12,
        snippet: "SOUTHSTONE MORTGAGE LLC, its successors and assigns",
        confidence_raw: 0.78,
        cost_usd: 0.0004,
        latency_ms: 1820,
        line_coords: null,
      },
      {
        id: "rdg_m1l_b",
        field_id: "fld_m1lender",
        engine_id: "llmwhisperer-hq",
        value: "S0UTHST0NE M0RTGAGE LLC",
        page: 12,
        snippet: "S0UTHST0NE M0RTGAGE LLC, its successors and assigns",
        confidence_raw: 0.71,
        cost_usd: 0.015,
        latency_ms: 3400,
        line_coords: [
          { page: 12, x0: 0.09, y0: 0.255, x1: 0.69, y1: 0.285 },
        ],
      },
    ],
  },
  {
    // A/B disagreement on a high-stakes amount — 8-for-6 on a faxed digit
    id: "fld_m1amt",
    order_id: oid,
    path: "mortgages.1.amount",
    value: null,
    na_reason: null,
    state: "needs_review",
    source_doc_id: "doc_secdeed",
    source_page: 14,
    source_snippet: null,
    source_line_coords: null,
    engine_id: null,
    engine_confidence_raw: null,
    rule_refs: ["S5-words-over-numerals"],
    approved_by: null,
    approved_at: null,
    asking: "Confirm the original principal amount of the security deed.",
    why: "The numerals print over a fax artefact; the readers split on one digit, and the words line above is legible.",
    readings: [
      {
        id: "rdg_m1a_a",
        field_id: "fld_m1amt",
        engine_id: "gemini-2.5-flash",
        value: "$166,097.00",
        page: 14,
        snippet: "…in the principal sum of $166,097.00…",
        confidence_raw: 0.84,
        cost_usd: 0.0004,
        latency_ms: 1740,
        line_coords: null,
      },
      {
        id: "rdg_m1a_b",
        field_id: "fld_m1amt",
        engine_id: "llmwhisperer-hq",
        value: "$186,097.00",
        page: 14,
        snippet: "…in the principal sum of $186,097.00…",
        confidence_raw: 0.71,
        cost_usd: 0.015,
        latency_ms: 3250,
        line_coords: [{ page: 14, x0: 0.09, y0: 0.465, x1: 0.61, y1: 0.495 }],
      },
    ],
  },
  {
    id: "fld_m1book",
    order_id: oid,
    path: "mortgages.1.book_page",
    value: "10944 / 218",
    na_reason: null,
    state: "confirmed",
    source_doc_id: "doc_secdeed",
    source_page: 12,
    source_snippet: "BK 10944 PG 218 — Security Deed dated 03/14/2019",
    source_line_coords: [{ page: 12, x0: 0.08, y0: 0.08, x1: 0.7, y1: 0.11 }],
    engine_id: "pdftotext",
    engine_confidence_raw: 0.98,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  },
  // ---- TAXES ---------------------------------------------------------------
  {
    id: "fld_land",
    order_id: oid,
    path: "assessment.land",
    value: "$28,000",
    na_reason: null,
    state: "confirmed",
    source_doc_id: "doc_tax",
    source_page: 22,
    source_snippet: "LAND 28,000   BLDG 158,400",
    source_line_coords: [{ page: 22, x0: 0.09, y0: 0.48, x1: 0.62, y1: 0.51 }],
    engine_id: "llmwhisperer-hq",
    engine_confidence_raw: 0.96,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  },
  {
    id: "fld_bldg",
    order_id: oid,
    path: "assessment.building",
    value: "$158,400",
    na_reason: null,
    state: "confirmed",
    source_doc_id: "doc_tax",
    source_page: 22,
    source_snippet: "LAND 28,000   BLDG 158,400",
    source_line_coords: [{ page: 22, x0: 0.09, y0: 0.48, x1: 0.62, y1: 0.51 }],
    engine_id: "llmwhisperer-hq",
    engine_confidence_raw: 0.96,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  },
  {
    // land + building ≠ total is CORRECT (v99 deliberately empty) — no chip, no fix
    id: "fld_total",
    order_id: oid,
    path: "assessment.total",
    value: "$189,200",
    na_reason: null,
    state: "confirmed",
    source_doc_id: "doc_tax",
    source_page: 22,
    source_snippet: "TOTAL APPRAISED VALUE 189,200",
    source_line_coords: [{ page: 22, x0: 0.09, y0: 0.54, x1: 0.66, y1: 0.57 }],
    engine_id: "llmwhisperer-hq",
    engine_confidence_raw: 0.96,
    rule_refs: ["v99-mixed-valuation-bases"],
    approved_by: null,
    approved_at: null,
  },
  {
    // pending: not yet extracted — distinct from both NA states
    id: "fld_taxstat",
    order_id: oid,
    path: "assessment.tax_status",
    value: null,
    na_reason: null,
    state: "pending",
    source_doc_id: null,
    source_page: null,
    source_snippet: null,
    source_line_coords: null,
    engine_id: null,
    engine_confidence_raw: null,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  },
  // ---- JUDGMENTS & LIENS ---------------------------------------------------
  {
    id: "fld_j1plf",
    order_id: oid,
    path: "judgments.1.plaintiff",
    value: "CREEKBANK RECOVERY SPV LLC",
    na_reason: null,
    state: "confirmed",
    source_doc_id: "doc_fifa",
    source_page: 29,
    source_snippet: "CREEKBANK RECOVERY SPV LLC vs. MARLOWE D. QUENBY",
    source_line_coords: [{ page: 29, x0: 0.08, y0: 0.2, x1: 0.82, y1: 0.23 }],
    engine_id: "pdftotext",
    engine_confidence_raw: 0.97,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  },
  {
    // Reader A returned nothing; Reader B found the line — never an auto-fill
    id: "fld_j1atty",
    order_id: oid,
    path: "judgments.1.plaintiff_attorney",
    value: null,
    na_reason: null,
    state: "needs_review",
    source_doc_id: "doc_fifa",
    source_page: 29,
    source_snippet: null,
    source_line_coords: null,
    engine_id: null,
    engine_confidence_raw: null,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
    asking: "Is Q. T. FENWICK & ASSOC., P.C. the plaintiff's attorney of record?",
    why: "One reader found the line and the other returned nothing — a blank is never filled in from the reader that did.",
    readings: [
      {
        id: "rdg_j1a_a",
        field_id: "fld_j1atty",
        engine_id: "gemini-2.5-flash",
        value: null,
        page: 29,
        snippet: null,
        confidence_raw: null,
        cost_usd: 0.0004,
        latency_ms: 1500,
        line_coords: null,
      },
      {
        id: "rdg_j1a_b",
        field_id: "fld_j1atty",
        engine_id: "llmwhisperer-hq",
        value: "Q. T. FENWICK & ASSOC., P.C.",
        page: 29,
        snippet: "Attorney of record: Q. T. FENWICK & ASSOC., P.C.",
        confidence_raw: 0.88,
        cost_usd: 0.015,
        latency_ms: 3050,
        line_coords: [{ page: 29, x0: 0.09, y0: 0.32, x1: 0.73, y1: 0.35 }],
      },
    ],
  },
  {
    // PRESENT_UNREADABLE: exists on a degraded scan — honest answer, always surfaced
    id: "fld_j1case",
    order_id: oid,
    path: "judgments.1.case_no",
    value: null,
    na_reason: "PRESENT_UNREADABLE",
    state: "needs_review",
    source_doc_id: "doc_fifa",
    source_page: 30,
    source_snippet: null,
    source_line_coords: null,
    engine_id: null,
    engine_confidence_raw: null,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
    asking: "Read the case number — or escalate if the frame cannot support one.",
    why: "The microfilm frame is degraded in this region; the number is on the page and neither reader could resolve it.",
  },
  {
    // NOT_FOUND: the field exists in this jurisdiction and was searched for;
    // nothing is of record. Distinct from NOT_PRESENT — this one IS surfaced,
    // because a real gap in the record is a finding. (Ratified Q1, 2026-07-26.)
    id: "fld_fedlien",
    order_id: oid,
    path: "judgments.1.federal_tax_lien",
    value: null,
    na_reason: "NOT_FOUND",
    state: "confirmed",
    source_doc_id: "doc_fifa",
    source_page: 28,
    source_snippet: "no federal tax lien index entries for the subject owner",
    source_line_coords: null,
    engine_id: "llmwhisperer-hq",
    engine_confidence_raw: null,
    rule_refs: [],
    approved_by: "rev_demo",
    approved_at: "2026-07-17T11:04:00Z",
  },
  {
    // NOT_STATED: the search returned the document and the document is silent.
    // Distinct from NOT_FOUND — the instrument exists, it just does not say.
    id: "fld_deeddated",
    order_id: oid,
    path: "deed.dated_date",
    value: null,
    na_reason: "NOT_STATED",
    state: "needs_review",
    source_doc_id: "doc_deed",
    source_page: 6,
    source_snippet: "…executed this ____ day of ____…",
    source_line_coords: null,
    engine_id: "gemini-2.5-flash",
    engine_confidence_raw: null,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
    asking: "Confirm the deed states no execution date.",
    why: "The instrument was returned and the execution date is left blank on its face.",
  },
  {
    // auto-confirmed with an EMPTY provenance envelope — principle 6's failure
    // shape; the UI must render it visibly flagged, never silently normal.
    id: "fld_j1amt",
    order_id: oid,
    path: "judgments.1.amount",
    value: "$4,112.83",
    na_reason: null,
    state: "auto_confirmed",
    source_doc_id: null,
    source_page: null,
    source_snippet: null,
    source_line_coords: null,
    engine_id: "gemini-2.5-flash",
    engine_confidence_raw: 0.95,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  },
];

/**
 * Rulebook demo: live rules an escalation can cite, plus one PENDING draft —
 * pending rules render visibly inert everywhere and cannot affect the
 * pipeline until an engineer confirms.
 */
export const demoRules: Rule[] = [
  {
    id: "rule_r13",
    code: "R13",
    text: "Report only judgments ACTIVE and ENFORCEABLE against the subject owner. Canceled/satisfied/vacated/released/duplicates suppress with reason. Status unknown → needs_review.",
    origin: "senior",
    status: "live",
    jurisdiction_scope: null,
    version: 1,
    confirmed_by: "eng_demo",
    source_doc_ref: "docs/rulings_2026-07.md",
  },
  {
    id: "rule_r22",
    code: "R22",
    text: "Lis pendens persists after dismissal; release/withdrawal renders as a linked pair. Only expungement removes.",
    origin: "senior",
    status: "live",
    jurisdiction_scope: null,
    version: 1,
    confirmed_by: "eng_demo",
    source_doc_ref: "docs/rulings_2026-07.md",
  },
  {
    id: "rule_tax_vintage",
    code: "ESC-TAX-01",
    text: "Report the bill for the county's current fiscal year; include a prior year only if it shows unpaid.",
    origin: "escalation",
    status: "live",
    jurisdiction_scope: null,
    version: 1,
    confirmed_by: "eng_demo",
    source_doc_ref: null,
  },
  {
    id: "rule_draft_hoa",
    code: "DRAFT-HOA-AGE",
    text: "HOA liens report regardless of age unless cancelled of record — age alone never drops one.",
    origin: "escalation",
    status: "pending",
    jurisdiction_scope: "GA",
    version: 1,
    confirmed_by: null,
    source_doc_ref: null,
  },
];

/**
 * Escalations — clustered by field path. Questions verbatim from reviewers.
 *
 * Every `order_ids` member is a row in `demoOrders`, and the second order is
 * `ord_demo_6` — the one whose stage IS `escalated`. It used to be
 * `ord_demo_2`, which nobody has claimed: an escalation against an unclaimed
 * order is a reviewer's question from a reviewer who does not exist.
 */
export const demoEscalations: Escalation[] = [
  {
    id: "esc_party_1",
    field_path_cluster: "judgments.hit_identity",
    order_ids: ["ord_demo_1"],
    question:
      "which of these 3 judgment hits is ours — same name, different case series",
    resolution: null,
    rule_id: null,
    resolved_by: null,
  },
  {
    id: "esc_party_2",
    field_path_cluster: "judgments.hit_identity",
    order_ids: ["ord_demo_6"],
    question: "is this the same defendant? ours has middle initial only",
    resolution: null,
    rule_id: null,
    resolved_by: null,
  },
  {
    id: "esc_party_3",
    field_path_cluster: "judgments.hit_identity",
    order_ids: ["ord_demo_1", "ord_demo_6"],
    question: "is a dismissed case still a hit?",
    resolution: null,
    rule_id: null,
    resolved_by: null,
  },
  {
    id: "esc_hoa_1",
    field_path_cluster: "liens.hoa_age",
    order_ids: ["ord_demo_6"],
    question: "same HOA as the one above, why is this one out?",
    resolution: null,
    rule_id: null,
    resolved_by: null,
  },
  {
    id: "esc_tax_1",
    field_path_cluster: "assessment.tax_bill_vintage",
    order_ids: ["ord_demo_1"],
    question:
      "two bills in the package — last year shows a balance, this year paid. which?",
    resolution:
      "Use the current fiscal year's bill; the prior year appears only when unpaid.",
    rule_id: "rule_tax_vintage",
    resolved_by: "M. Estrada",
  },
];

/** The two delivered orders and the one whose delivery bounced. */
const deliveredOrder = rowOrThrow("ord_demo_12");
const complainedOrder = rowOrThrow("ord_demo_13");
const bouncedOrder = rowOrThrow("ord_demo_8");

/**
 * Deliveries — a failed delivery is a TRANSIT state (attend), never a quality
 * state (act). v1 + v2 of the complained-about order are both retained: the
 * pair is the defect record.
 *
 * EVERY `report.order_id` NAMES A ROW THAT CAN HOLD ONE, and the terminal
 * `delivered_at` is quoted from that row rather than restated. Before
 * 2026-07-30 this store delivered `ord_demo_1` (which sits at a gate and has
 * never been delivered), bounced `ord_demo_2` (which nobody has claimed), and
 * split the v1/v2 defect pair across two different orders — three ways of
 * saying something the order table denies.
 */
export const demoDeliveries: DeliveryWithReport[] = [
  {
    id: "del_1",
    report_id: "rep_1",
    method: "email",
    status: "delivered",
    attempted_at: "2026-07-24T17:19:40Z",
    delivered_at: deliveredOrder.delivered_at,
    evidence: "smtp accepted · message-id 8812@demo",
    report: {
      id: "rep_1",
      order_id: deliveredOrder.id,
      version: 1,
      shape: "A",
      rendered_at: "2026-07-24T17:18:20Z",
    },
  },
  {
    id: "del_2",
    report_id: "rep_2",
    method: "portal",
    status: "failed_transit",
    attempted_at: "2026-07-24T16:05:00Z",
    // Null, and it agrees with the row: a bounced delivery reached nobody.
    delivered_at: bouncedOrder.delivered_at,
    evidence: "client portal returned 503 · credential valid",
    report: {
      id: "rep_2",
      order_id: bouncedOrder.id,
      version: 1,
      shape: "A",
      rendered_at: "2026-07-24T16:02:20Z",
    },
  },
  {
    id: "del_3",
    report_id: "rep_3",
    method: "email",
    status: "delivered",
    attempted_at: "2026-07-24T15:50:00Z",
    delivered_at: "2026-07-24T15:50:30Z",
    evidence: null,
    report: {
      id: "rep_3",
      order_id: complainedOrder.id,
      version: 1,
      shape: "B",
      rendered_at: "2026-07-24T15:48:10Z",
    },
  },
  {
    id: "del_4",
    report_id: "rep_4",
    method: "email",
    status: "delivered",
    attempted_at: "2026-07-24T17:19:00Z",
    delivered_at: complainedOrder.delivered_at,
    evidence: "after complaint · changed: judgments.1.type",
    report: {
      id: "rep_4",
      order_id: complainedOrder.id,
      version: 2,
      shape: "B",
      rendered_at: "2026-07-24T17:17:00Z",
    },
  },
];

/**
 * Complaints — grouped by how_it_got_through. An auto_confirmed complaint
 * means NO HUMAN SAW IT: the threshold is wrong, not a reviewer.
 *
 * Every `order_id` is an order that was actually DELIVERED, because a
 * complaint is a client's word about something they received. `cmp_2` and
 * `cmp_3` sit on the same order as the v1/v2 delivery pair above — the
 * complaint, the re-render and the rule are one record.
 */
export const demoComplaints: Complaint[] = [
  {
    id: "cmp_1",
    order_id: deliveredOrder.id,
    field_path: "assessment.city_tax",
    shipped_value: null,
    client_value: "$611.20 DELINQ",
    how_it_got_through: "auto_confirmed",
    resolution: null,
    rule_id: null,
    golden_offer_accepted: null,
  },
  {
    id: "cmp_2",
    order_id: complainedOrder.id,
    field_path: "judgments.1.type",
    shipped_value: "Judgment",
    client_value: "Lis Pendens",
    how_it_got_through: "human_confirmed",
    resolution:
      "fixed · v2 delivered · rule → rulebook (origin=complaint) · added to golden set",
    rule_id: "rule_r22",
    golden_offer_accepted: true,
  },
  {
    id: "cmp_3",
    order_id: complainedOrder.id,
    field_path: "judgments.1.included",
    shipped_value: "omitted (dismissed)",
    client_value: "included",
    how_it_got_through: "human_confirmed",
    resolution: null,
    rule_id: null,
    golden_offer_accepted: null,
  },
];

/**
 * Golden set — the seed bench. The famous case: mortgages.1.amount seed
 * $202,224 (delivered_report, typist read a degraded fax) vs model $220,224;
 * §5 words-over-numerals says the seed is likely wrong.
 */
export const demoGolden: GoldenField[] = [
  {
    id: "gf_1",
    order_id: "ord_seed_greene",
    path: "mortgages.1.amount",
    value: "$202,224.00",
    tag: "delivered_report",
    source_citation: null,
    corrected_from: null,
    corrected_by: null,
    corrected_at: null,
    correction_reason: null,
  },
  {
    id: "gf_2",
    order_id: "ord_seed_greene",
    path: "judgments.1.type",
    value: "Lis Pendens",
    tag: "ruled",
    source_citation: "FiFa search p 29 — NOTICE OF LIS PENDENS 23-CV-0871",
    corrected_from: "Judgment",
    corrected_by: "M. Estrada",
    corrected_at: "2026-07-09T14:02:00Z",
    correction_reason:
      "a lis pendens is a pending-suit notice, not a judgment — reports under its own type",
  },
  {
    id: "gf_3",
    order_id: "ord_seed_mecklenburg",
    path: "judgments.1.plaintiff_attorney",
    value: null,
    tag: "suspect",
    source_citation: null,
    corrected_from: null,
    corrected_by: null,
    corrected_at: null,
    correction_reason: null,
  },
  {
    id: "gf_4",
    order_id: "ord_seed_mecklenburg",
    path: "deed.consideration",
    value: "$185,000.00",
    tag: "agreed",
    source_citation: "warranty deed p 4",
    corrected_from: null,
    corrected_by: null,
    corrected_at: null,
    correction_reason: null,
  },
];

const liveOrder = rowOrThrow("ord_demo_1");
const nextUpOrder = rowOrThrow("ord_demo_2");

/**
 * Order timelines — the spine each order draws through the pipeline
 * (StatusRail). Server-authored in production; kinds stay an open vocabulary
 * until the FastAPI port. `attend: true` = amber on the rail.
 *
 * EVERY TIMELINE AGREES WITH ITS ROW, and the three anchor timestamps are
 * quoted from it rather than restated. Three things this used to say that the
 * order table denies, all fixed here:
 *   - `ord_demo_1` ended "delivered v1" while sitting at a gate with a null
 *     `delivered_at`. A spine that says delivered is a delivery claim.
 *   - `ord_demo_2` was "accepted · signed R. Okafor" while unclaimed by
 *     anybody. The machine pre-read it; nobody has taken it, so there is no
 *     acceptance to draw.
 *   - `ord_demo_3` is not an order. It is now keyed to `ord_demo_13`, the
 *     delivered order the v1/v2 defect pair and the complaints belong to.
 *
 * Page counts are quoted, never restated: the 38 that used to sit on the first
 * line was the number this whole wave exists to kill.
 *
 * The review and escalation lines are QUOTED from the stores they summarize
 * (`demoFields` / `demoEscalations`), never restated: this spine used to say
 * "review 14/19 · 5 fields queued" over a field store serving 21 values with 6
 * queued, and cite a mortgages.1.amount escalation the escalation store does
 * not hold.
 */
const liveFieldsQueued = demoFields.filter((f) => f.state === "needs_review").length;
const liveFieldsDecided = demoFields.length - liveFieldsQueued;
const liveOpenEscalations = demoEscalations.filter(
  (e) => e.order_ids.includes(liveOrder.id) && e.resolution === null,
);

export const demoTimelines: Record<string, OrderTimelineEvent[]> = {
  [liveOrder.id]: [
    { at: liveOrder.arrived_at, kind: "arrived", label: "arrived", detail: `SFTP · ${liveOrder.jurisdiction}`, attend: false },
    { at: liveOrder.accepted_at ?? liveOrder.arrived_at, kind: "accepted", label: "accepted", detail: "signed R. Okafor", attend: false },
    { at: "2026-07-24T13:41:00Z", kind: "extracted", label: "extracted", detail: `${PACKAGE_PAGES_RELEVANT} relevant pages · 2 engines`, attend: false },
    { at: "2026-07-24T15:02:00Z", kind: "review", label: `review ${liveFieldsDecided}/${demoFields.length}`, detail: `${liveFieldsQueued} fields queued`, attend: false },
    {
      at: "2026-07-24T15:20:00Z", kind: "escalated", attend: true,
      label: `escalations open — ${liveOpenEscalations.length}`,
      detail: [...new Set(liveOpenEscalations.map((e) => e.field_path_cluster))].join(" · "),
    },
  ],
  // Unclaimed: arrival and the machine's pre-read, and nothing a person did.
  [nextUpOrder.id]: [
    { at: nextUpOrder.arrived_at, kind: "arrived", label: "arrived", detail: `email · ${nextUpOrder.jurisdiction}`, attend: false },
    {
      at: "2026-07-24T13:35:00Z", kind: "extracted", label: "extracted", attend: false,
      detail: nextUpOrder.pages === null
        ? "package unreadable · 2 engines"
        : `${nextUpOrder.pages} pages received · 2 engines`,
    },
  ],
  [complainedOrder.id]: [
    { at: complainedOrder.arrived_at, kind: "arrived", label: "arrived", detail: "portal", attend: false },
    { at: complainedOrder.accepted_at ?? complainedOrder.arrived_at, kind: "accepted", label: "accepted", detail: "signed R. Okafor", attend: false },
    { at: "2026-07-24T14:44:00Z", kind: "review", label: "review 19/19", detail: null, attend: false },
    { at: "2026-07-24T15:50:30Z", kind: "delivered", label: "delivered v1", detail: "email", attend: false },
    { at: "2026-07-24T16:40:00Z", kind: "complaint", label: "complaint · field 14", detail: "judgments.1.type", attend: true },
    { at: complainedOrder.delivered_at ?? DELIVERED, kind: "delivered", label: "delivered v2", detail: "v1+v2 retained — defect record", attend: true },
  ],
};

/**
 * Source page text for ord_demo_1. Clearly synthetic, and deliberately
 * consistent with `demoFields`: every CITED page here is one a field cites, so
 * the provenance on the review screen resolves to real text rather than to a
 * page that says nothing about the value claiming it.
 *
 * The total is QUOTED from the order's own package size, and the ONE extra
 * entry (n:18, `read_in_full: false`) exists for the coverage spine
 * (`CoverageSpine.tsx`): a fixture that only ever contained cited, fully-read
 * pages could not exercise "present but not fully read" as distinct from
 * "absent from the array entirely" — the spine's whole reason for existing is
 * telling those two apart.
 *
 * This array is a SAMPLE of the package, not the package: the entries are the
 * cited pages plus the unread one. Nothing may count it to learn how much was
 * read — `PACKAGE_PAGES_RELEVANT` is that number.
 */
export const demoPages: Record<string, { total: number; pages: { n: number; read_in_full: boolean; kind: string; lines: string[]; degraded: boolean }[] }> = {
  [liveOrder.id]: {
    total: liveOrder.pages ?? PACKAGE_PAGES,
    pages: [
      { n: 6, read_in_full: true, degraded: false, kind: "WARRANTY DEED", lines: [
        "OFFICIAL RECORDS · CLAYTON CO. GA",
        "INSTR # 2019-0044821    BK 10944 PG 213",
        "RECORDED 04/11/2019 10:22",
        "",
        "THIS INDENTURE, made this 9th day of April, 2019, between",
        "HUNTCREST BUILDERS LLC, a Georgia limited liability company,",
        "hereinafter the Grantor, and",
        "MARLOWE D. QUENBY AND TESSA R. QUENBY, husband and wife,",
        "hereinafter the Grantees, WITNESSETH:",
        "",
        "That the Grantor does hereby convey unto the Grantees the real",
        "property described in Exhibit A, situate in Clayton County, Georgia.",
        "Consideration: $215,000.00",
        "Property address: 4152 CREEKSTONE DR, DEMOVILLE GA 30296",
      ] },
      { n: 7, read_in_full: true, degraded: false, kind: "EXHIBIT A — LEGAL DESCRIPTION", lines: [
        "The land referred to is situated in the County of Clayton,",
        "State of Georgia, and is described as follows:",
        "",
        "Lot 18, of CREEKSTONE FARMS, according to the metes and",
        "bounds description of record; no plat of survey is of record",
        "for this subdivision.",
      ] },
      { n: 12, read_in_full: true, degraded: false, kind: "SECURITY DEED", lines: [
        "OFFICIAL RECORDS · CLAYTON CO. GA",
        "INSTR # 2019-0044822    BK 10944 PG 218",
        "",
        "THIS SECURITY DEED is made on April 9, 2019, between the Grantor,",
        "MARLOWE D. QUENBY AND TESSA R. QUENBY, and the Grantee,",
        "SOUTHSTONE MORTGAGE LLC, its successors and assigns.",
      ] },
      { n: 14, read_in_full: true, degraded: true, kind: "SECURITY DEED (cont.)", lines: [
        "Borrower owes Lender the principal sum of",
        "One Hundred Sixty-Six Thousand Ninety-Seven and 00/100 Dollars",
        "($1ß6,097.00)",
        "[ fax artefact over the numerals — the words line above is legible ]",
        "This debt is evidenced by Borrower's note dated the same date.",
      ] },
      { n: 18, read_in_full: false, degraded: false, kind: "PLAT REFERENCE — COVER SHEET", lines: [
        "Cover sheet for the plat referenced in Exhibit A. The classifier",
        "found nothing here the report needs, so no reader read it in full.",
      ] },
      { n: 22, read_in_full: true, degraded: false, kind: "CLAYTON COUNTY TAX COMMISSIONER", lines: [
        "PARCEL ........... 13-0044-0018",
        "OWNER ............ QUENBY MARLOWE D",
        "SITUS ............ 4152 CREEKSTONE DR",
        "                   DEMOVILLE GA 30296",
        "LAND VALUE ....... 28,000",
        "BUILDING VALUE ... 158,400",
        "2025 STATUS ...... (not printed on this card)",
      ] },
      { n: 28, read_in_full: true, degraded: false, kind: "FIFA SEARCH — FEDERAL TAX LIEN INDEX", lines: [
        "CLAYTON COUNTY · FEDERAL TAX LIEN INDEX",
        "SEARCHED: QUENBY MARLOWE D · QUENBY TESSA R",
        "",
        "no federal tax lien index entries for the subject owner",
      ] },
      { n: 29, read_in_full: true, degraded: false, kind: "FIFA SEARCH — GENERAL EXECUTION DOCKET", lines: [
        "GENERAL EXECUTION DOCKET · CLAYTON COUNTY",
        "WRIT OF FIERI FACIAS",
        "",
        "CREEKBANK RECOVERY SPV LLC vs. MARLOWE D. QUENBY",
        "",
        "Attorney of record: Q. T. FENWICK & ASSOC., P.C.",
      ] },
      { n: 30, read_in_full: true, degraded: true, kind: "FIFA SEARCH — SUPERIOR COURT", lines: [
        "IN THE SUPERIOR COURT OF CLAYTON COUNTY",
        "STATE OF GEORGIA · CIVIL DIVISION",
        "",
        "CREEKBANK RECOVERY SPV LLC, Plaintiff,",
        "v.",
        "M. QUENBY, Defendant.",
        "",
        "CASE NO. [ microfilm frame degraded — density loss ]",
        "JUDGMENT entered in the sum of $4,112.83",
      ] },
    ],
  },
};
