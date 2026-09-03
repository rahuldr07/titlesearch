import type {
  Complaint,
  DeliveryWithReport,
  Escalation,
  Field,
  GoldenField,
  Order,
  OrderTimelineEvent,
  PackageInstrument,
  Rule,
} from "@titlepipe/contract";

/**
 * Synthetic demo data, scrubbed of anything resembling real NPI: clearly
 * synthetic persons/companies. The shapes and the weird states are preserved
 * exactly — A/B disagreement, the NA states, a degraded-scan unreadable, a
 * pending field, and an auto-confirmed value with no provenance (rendered
 * flagged). line_coords are `LineCoords` fractions of the rendered page box;
 * a box that runs off its page fails to parse. Excerpts are built with
 * `excerpt()` below so a field's flat `source_snippet` and its split
 * `source_excerpt` cannot drift into two different quotations of one line.
 */

/**
 * The one demo order set. Every endpoint that lists, counts, or names an
 * order projects this table — a second copy of a fact is a second answer.
 * For the projection layers (`workspace.ts` / `handlers.ts`):
 *   - `demoOrders`       — every order, in no meaningful order. Filter it.
 *   - `demoOrderRow(id)` — one row, or `undefined`. Never invent a placeholder.
 *   - `demoOrderEntity`  — the row as the contract's `Order`. Adding a field
 *                          to the `Order` schema edits that function only.
 *   - `demoQueue`        — the served queue, in the server's order.
 *   - `PACKAGE_PAGES` / `PACKAGE_PAGES_RELEVANT` / `PRODUCT_NAME` /
 *     `PERIOD_LABEL` — the anchors. Quote them; never restate the numeral.
 */
export const PACKAGE_PAGES = 64;
/**
 * Pages the classifier carried forward out of `PACKAGE_PAGES`. Quoted, never
 * restated as a numeral. Not derivable from `demoPages` below — that fixture
 * serves a sample of the package, so counting it would answer a different
 * question.
 */
export const PACKAGE_PAGES_RELEVANT = 11;
export const PRODUCT_NAME = "40-Year Search";
export const PERIOD_LABEL = "40-year period · 07/18/1986 – 07/18/2026";

/** Which queue band lists an order. `null` = listed by no band. */
export type DemoBandId = "mine" | "held" | "in_flight" | "delivered";
/**
 * The overview board's columns. There is no `failed` member: a failed order
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
   * The rendered period label. Named `period` on the row and `period_label`
   * on the wire; `demoOrderEntity` is the one place the two names meet.
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
   * The server's word for where this order stands, not a state-machine
   * member. A free string on purpose: an enum invites `switch (order.state)`
   * in the browser.
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
 * Status and the three timestamps are derived from the stage, not restated
 * per row: a fixture that lets an order be `delivered` with a null
 * `delivered_at` is the class of self-contradiction this table exists to end.
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
    id: "ord_real_1", order_ref: "4087333-1", queue_position: null,
    band: "mine", stage: "review", mine: true, failed: false,
    addr: "Real search package — Lincoln County", place: "Lincoln County · MO",
    jurisdiction: "lincoln-mo", county: "Lincoln", state: "MO",
    product: PRODUCT_NAME, period: PERIOD_LABEL, pages: 104,
    waited: null, waiting_on: "Real OCR package", state_label: null,
    stamp_label: "Read by unlimited-ocr", stamp_tone: "settled",
  }),
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
  /*
   * The one order whose gates are all green. It exists so both release
   * paths are exercisable: 4176034-1 still refuses with its open gates, and
   * this one seals. A fixture with only the happy path is the same defect
   * as one with only the refusal.
   */
  row({
    id: "ord_demo_14", order_ref: "4176028-5", queue_position: null,
    band: "in_flight", stage: "review", mine: true, failed: false,
    addr: "310 Wrenfield Ln, Demoville GA", place: "Clayton County · GA",
    jurisdiction: "clayton-ga", county: "Clayton", state: "GA",
    product: "Two-Owner Search", period: "current owner + one prior owner", pages: 27,
    waited: "18m", waiting_on: "Release signature", state_label: null,
    stamp_label: "Cleared for release", stamp_tone: "settled",
  }),
];

/*
 * What a release CHANGES. The rows are readonly and static, so a signed
 * release filed a seal and left the order still reading "Review" in the rail,
 * the stage strip and every list — the one act in the pipeline that is
 * supposed to move an order moved nothing. This overlay is that movement.
 * Session-lived, like the seal it follows.
 */
const releasedOverlay = new Map<string, Partial<DemoOrderRow>>();

export function markOrderReleased(id: string, at: string): void {
  releasedOverlay.set(id, {
    stage: "delivered",
    status: "delivered",
    delivered_at: at,
    waiting_on: "Released and sealed",
    state_label: null,
    stamp_label: "Released · sealed",
    stamp_tone: "settled",
  });
}

export function clearReleasedOverlay(): void {
  releasedOverlay.clear();
}

/** Every row, with any release applied. The one list handlers should read. */
/*
 * Orders created this session by `POST /api/orders`. The handler minted an
 * id, returned it and registered it NOWHERE, so the screen it navigated to
 * asked for `ord_new_1` and the server answered "no such order" — an intake
 * that completes and then denies its own package.
 */
const createdRows: DemoOrderRow[] = [];

export function addCreatedOrder(row: DemoOrderRow): void {
  createdRows.push(row);
}

export function clearCreatedOrders(): void {
  createdRows.length = 0;
}

export function demoOrderRows(): readonly DemoOrderRow[] {
  return [...demoOrders, ...createdRows].map((r) => {
    const over = releasedOverlay.get(r.id);
    return over === undefined ? r : { ...r, ...over };
  });
}

/** An order's reference from its id — the join the wire now carries. */
export function refOf(orderId: string): string | null {
  return [...demoOrders, ...createdRows].find((r) => r.id === orderId)?.order_ref ?? null;
}

export function demoOrderRow(id: string): DemoOrderRow | undefined {
  const base = [...demoOrders, ...createdRows].find((r) => r.id === id);
  if (base === undefined) return undefined;
  const over = releasedOverlay.get(id);
  return over === undefined ? base : { ...base, ...over };
}

/**
 * The same lookup for this file's own derivations, where a missing row is a
 * fixture bug rather than a runtime condition.
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
 * Server-ordered — the point of `queue_position` being data: the queue is
 * not a list to shop through, so the order of service is a fact the fixture
 * states rather than an accident of array order.
 */
export const demoQueue: readonly DemoOrderRow[] = demoOrders
  .filter((r) => r.queue_position !== null)
  .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));

/**
 * @deprecated Projections of the shared set, kept only so `handlers.ts` and
 * `index.ts` keep compiling while the queue handler is repointed at
 * `demoQueue`. Delete both with that change — a named singleton is how the
 * second copy started.
 */
export const demoOrder: Order = demoOrderEntity(rowOrThrow("ord_demo_1"));
/** @deprecated See `demoOrder`. */
export const demoOrder2: Order = demoOrderEntity(rowOrThrow("ord_demo_2"));

import { realPackage } from "./realPackage.js";

/**
 * The package's five divisions, as PATH HEADS.
 *
 * The review screen's `sectionOf` is the path's FIRST SEGMENT and nothing
 * else, which is why `demoFields` is pathed `mortgages.1.lender` and
 * `assessment.tax_status`. The extractor emitted every real field under one
 * flat `package.` prefix, so all 69 landed in a single bucket and the
 * workstation drew them as one undivided flow of 69 rows with the heading
 * "Package" — the document's own structure, which the OCR had correctly
 * captured, thrown away at the last step.
 *
 * The fixture's `section` member cannot carry it instead: `Field` has no
 * `section`, so Zod strips it at the browser boundary, and widening the
 * contract locally to suit one fixture is forbidden. So the division rides
 * where the screen already looks for it.
 *
 * Unmapped sections throw rather than defaulting: a regenerated
 * `realPackage.json` that introduces a sixth division must be spelled here,
 * because the failure mode of a silent fallback is exactly the collapse
 * above — invisible, and wrong in the direction of "looks fine".
 */
const REAL_SECTION_PATH: Readonly<Record<string, string>> = {
  "ABSTRACTOR CALL BACK SHEET": "callback",
  "CURRENT VESTING DEED INFORMATION": "vesting",
  "DEED OF TRUST": "deed_of_trust",
  "PRIOR DEED": "prior_deed",
  "JUDGMENTS/LIENS": "judgments",
};

/**
 * The real 104-page county package, OCR'd at
 * projects/ocr/runs/web_1786595970_6ef37d. Values, pages, snippets and
 * coordinates are all read off the document — nothing here is authored.
 * Every field is `auto_confirmed`: the pipeline read it and no human has,
 * which is the only state the OCR output supports. No `asking`, `why` or
 * `consequence` — those are rulebook prose and this package has no ruling.
 */
export const realFields: Field[] = realPackage.fields.map((f) => {
  const head = REAL_SECTION_PATH[f.section];
  if (head === undefined) {
    throw new Error(
      `realPackage.json: section ${JSON.stringify(f.section)} has no path head. ` +
        `Add it to REAL_SECTION_PATH in data.ts, or the review screen draws ` +
        `this package as one undivided list.`,
    );
  }
  return {
    ...f,
    order_id: "ord_real_1",
    path: `${head}.${f.path.replace(/^package\./, "")}`,
    na_reason: null,
    state: "auto_confirmed" as const,
    engine_confidence_raw: null,
    rule_refs: [] as string[],
    approved_by: null,
    approved_at: null,
  };
});

/** The live review order — the package `demoFields` and `demoPages` describe. */
const oid = "ord_demo_1";

/**
 * The three T1 rule refs — ruinous exposure, tagged by the rulebook. Which
 * fields carry the exposure is a rulebook judgement, so it rides on
 * `rule_refs`; the review screen reads the tag rather than holding a path
 * list, which is what makes the T1 pill server-said rather than
 * browser-decided. The three are the three the rulebook already has rules
 * about: the lender of record, the secured principal (S5
 * words-over-numerals), and the judgment party (R13).
 */
const T1_LENDER = "T1-lien-holder-identity";
const T1_PRINCIPAL = "T1-secured-principal";
const T1_JUDGMENT_PARTY = "T1-judgment-party-identity";

/**
 * One excerpt, written once, emitted twice: the contract requires
 * `pre + hit + post` to be the snippet, so the flat one is concatenated here
 * and neither can drift. A field whose merged read adopted no excerpt gets
 * neither member — inventing a highlight would assert a match nothing made.
 */
function excerpt(
  docId: string,
  page: number,
  pre: string,
  hit: string,
  post: string,
  note: string | null = null,
): Pick<Field, "source_snippet" | "source_excerpt"> {
  return {
    source_snippet: `${pre}${hit}${post}`,
    source_excerpt: { doc_id: docId, page, pre, hit, post, note },
  };
}

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
    source_line_coords: { page: 6, x: 0.08, y: 0.3, w: 0.84, h: 0.035 },
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
    source_line_coords: { page: 6, x: 0.08, y: 0.44, w: 0.8, h: 0.032 },
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
    ...excerpt("doc_tax", 22, "DEMOVILLE GA ", "30296", ""),
    source_line_coords: { page: 22, x: 0.08, y: 0.43, w: 0.42, h: 0.13 },
    engine_id: "llmwhisperer-hq",
    engine_confidence_raw: 0.62,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
    // Server-authored question and reason. Present on the queued decisions
    // and absent — not null — on every field that never went to review.
    asking: "Confirm the ZIP on the tax card.",
    consequence:
      "A wrong ZIP on the tax card indexes the policy against a parcel this report does not describe.",
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
        line_coords: { page: 22, x: 0.08, y: 0.43, w: 0.42, h: 0.13 },
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
    source_line_coords: { page: 7, x: 0.08, y: 0.38, w: 0.78, h: 0.03 },
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
    source_line_coords: { page: 6, x: 0.08, y: 0.26, w: 0.72, h: 0.03 },
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
    source_line_coords: { page: 6, x: 0.08, y: 0.06, w: 0.42, h: 0.03 },
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
    source_line_coords: { page: 6, x: 0.08, y: 0.58, w: 0.76, h: 0.03 },
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
    rule_refs: [T1_LENDER],
    approved_by: null,
    approved_at: null,
    asking: "Is the lender SOUTHSTONE MORTGAGE LLC?",
    consequence:
      "Naming the wrong holder of an open security deed sends the payoff to a stranger and leaves the real lien of record.",
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
        line_coords: { page: 12, x: 0.09, y: 0.255, w: 0.6, h: 0.03 },
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
    /* The MERGE could not adopt a value, and it still located the line: the
       readers disagree about the numerals, not about where they sit. */
    ...excerpt(
      "doc_secdeed",
      14,
      "Borrower owes Lender the principal sum of One Hundred Sixty-Six Thousand Ninety-Seven and 00/100 Dollars ",
      "($1ß6,097.00)",
      "",
      "The words line is legible and the numerals carry a fax artefact. S5 reads words over numerals; do not key what the digits appear to say.",
    ),
    source_line_coords: { page: 14, x: 0.08, y: 0.37, w: 0.36, h: 0.13 },
    engine_id: null,
    engine_confidence_raw: null,
    rule_refs: [T1_PRINCIPAL, "S5-words-over-numerals"],
    approved_by: null,
    approved_at: null,
    asking: "Confirm the original principal amount of the security deed.",
    consequence:
      "An understated secured principal understates the payoff, and the shortfall survives closing as a lien against the parcel.",
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
        line_coords: { page: 14, x: 0.09, y: 0.465, w: 0.52, h: 0.03 },
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
    source_line_coords: { page: 12, x: 0.08, y: 0.08, w: 0.62, h: 0.03 },
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
    source_line_coords: { page: 22, x: 0.09, y: 0.48, w: 0.53, h: 0.03 },
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
    source_line_coords: { page: 22, x: 0.09, y: 0.48, w: 0.53, h: 0.03 },
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
    source_line_coords: { page: 22, x: 0.09, y: 0.54, w: 0.57, h: 0.03 },
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
    source_line_coords: { page: 29, x: 0.08, y: 0.2, w: 0.74, h: 0.03 },
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
    rule_refs: [T1_JUDGMENT_PARTY],
    approved_by: null,
    approved_at: null,
    asking: "Is Q. T. FENWICK & ASSOC., P.C. the plaintiff's attorney of record?",
    consequence:
      "The attorney of record is who a satisfaction is demanded from; the wrong firm means the demand reaches nobody.",
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
        line_coords: { page: 29, x: 0.09, y: 0.32, w: 0.64, h: 0.03 },
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
    ...excerpt(
      "doc_fifa",
      30,
      "CASE NO. ",
      "[ microfilm frame degraded — density loss ]",
      "",
      "Law 3: the frame is present and below the contrast floor. Declare it unreadable by name — never key a case number the frame does not carry.",
    ),
    source_line_coords: { page: 30, x: 0.08, y: 0.72, w: 0.66, h: 0.11 },
    engine_id: null,
    engine_confidence_raw: null,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
    asking: "Read the case number — or escalate if the frame cannot support one.",
    consequence:
      "A judgment with no case number cannot be searched or satisfied of record, and a guessed one attaches the wrong docket.",
    why: "The microfilm frame is degraded in this region; the number is on the page and neither reader could resolve it.",
  },
  {
    // NOT_FOUND: the field exists in this jurisdiction and was searched for;
    // nothing is of record. Distinct from NOT_PRESENT — this one is
    // surfaced, because a real gap in the record is a finding.
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
    ...excerpt(
      "doc_deed",
      6,
      "IN WITNESS WHEREOF, the Grantor has executed this ",
      "____ day of ____",
      ", 2019.",
      "The clause is printed and left blank. NOT_STATED, not NOT_PRESENT — the instrument carries the line and says nothing on it.",
    ),
    source_line_coords: { page: 6, x: 0.08, y: 0.87, w: 0.78, h: 0.1 },
    engine_id: "gemini-2.5-flash",
    engine_confidence_raw: null,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
    asking: "Confirm the deed states no execution date.",
    consequence:
      "Recording an execution date the deed does not carry invents a date the chain can be challenged on.",
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
 * READINGS PAYLOADS THAT ARE NOT A TWO-ENGINE PAIR.
 *
 * Every fixture in `demoFields` carries exactly two readings from two
 * distinct engines, which is why no test could ever catch the UI treating
 * "the array has 2+ entries with differing values" as "the engines
 * disagreed", or treating `readings[0..1]` as a server nomination. Both
 * shapes below are permitted by the contract — `Field.readings` is an
 * unbounded `z.array(FieldReading)` of ALL pre-merge values, and
 * `services/core-api` has no readings serializer or `(field_id, engine_id)`
 * unique constraint to bound it.
 *
 * DELIBERATELY NOT MEMBERS OF `demoFields`. The demo order's queue length,
 * its per-state counts and its coverage spine are asserted across the
 * Playwright suite; a fixture that exists to prove a refusal must not move
 * those numbers. These are imported directly by the tests that need them.
 */

/**
 * THREE readings, three engines. `nominatedPair` used to return the first
 * two and drop the third silently — the UI editing the evidence.
 */
export const threeReadingField: Field = {
  id: "fld_three_readings",
  order_id: oid,
  path: "vesting.owner",
  value: null,
  na_reason: null,
  state: "needs_review",
  source_doc_id: "doc_deed",
  source_page: 8,
  source_snippet: null,
  source_line_coords: null,
  engine_id: null,
  engine_confidence_raw: null,
  rule_refs: [],
  approved_by: null,
  approved_at: null,
  asking: "Is the vested owner MARIA L. ESTRADA?",
  consequence: "The wrong vested owner insures a stranger's interest.",
  why: "Three readers were consulted and did not converge.",
  readings: [
    {
      id: "rdg_three_a",
      field_id: "fld_three_readings",
      engine_id: "gemini-2.5-flash",
      value: "MARIA L. ESTRADA",
      page: 8,
      snippet: "…unto MARIA L. ESTRADA, a married woman…",
      confidence_raw: 0.88,
      cost_usd: 0.0004,
      latency_ms: 1610,
      line_coords: null,
    },
    {
      id: "rdg_three_b",
      field_id: "fld_three_readings",
      engine_id: "llmwhisperer-hq",
      value: "MARIA I. ESTRADA",
      page: 8,
      snippet: "…unto MARIA I. ESTRADA, a married woman…",
      confidence_raw: 0.74,
      cost_usd: 0.015,
      latency_ms: 3220,
      line_coords: { page: 8, x: 0.1, y: 0.31, w: 0.52, h: 0.03 },
    },
    {
      id: "rdg_three_c",
      field_id: "fld_three_readings",
      engine_id: "paddle-ocr",
      value: "MARIA L ESTRADA",
      page: 8,
      snippet: "…unto MARIA L ESTRADA, a married woman…",
      confidence_raw: 0.69,
      cost_usd: 0.0002,
      latency_ms: 890,
      line_coords: { page: 8, x: 0.1, y: 0.31, w: 0.52, h: 0.03 },
    },
  ],
};

/**
 * TWO readings, ONE engine — one value spanning two lines, which the
 * contract says is two readings each with its own box (entities.ts:25).
 * The values differ because they are FRAGMENTS of one value, not two
 * accounts of it. Cardinality-based disagreement drew a false A≠B chip here
 * and handed `ReadingPair` the same engine id for both seats.
 */
export const lineFragmentField: Field = {
  id: "fld_line_fragments",
  order_id: oid,
  path: "legal.description",
  value: null,
  na_reason: null,
  state: "needs_review",
  source_doc_id: "doc_deed",
  source_page: 9,
  source_snippet: null,
  source_line_coords: null,
  engine_id: null,
  engine_confidence_raw: null,
  rule_refs: [],
  approved_by: null,
  approved_at: null,
  asking: "Confirm the legal description.",
  consequence: "A truncated legal description describes a parcel that does not exist.",
  why: "The description wraps across two printed lines.",
  readings: [
    {
      id: "rdg_frag_1",
      field_id: "fld_line_fragments",
      engine_id: "llmwhisperer-hq",
      value: "ALL THAT TRACT OR PARCEL OF LAND lying and being in",
      page: 9,
      snippet: "ALL THAT TRACT OR PARCEL OF LAND lying and being in",
      confidence_raw: 0.93,
      cost_usd: 0.015,
      latency_ms: 3100,
      line_coords: { page: 9, x: 0.08, y: 0.41, w: 0.7, h: 0.02 },
    },
    {
      id: "rdg_frag_2",
      field_id: "fld_line_fragments",
      engine_id: "llmwhisperer-hq",
      value: "Land Lot 44 of the 13th District, Clayton County, Georgia.",
      page: 9,
      snippet: "Land Lot 44 of the 13th District, Clayton County, Georgia.",
      confidence_raw: 0.91,
      cost_usd: 0.015,
      latency_ms: 3100,
      line_coords: { page: 9, x: 0.08, y: 0.435, w: 0.72, h: 0.02 },
    },
  ],
};

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
 * Every `order_ids` member is a row in `demoOrders`; an escalation must
 * name a claimed order — an escalation against an unclaimed order is a
 * question from a reviewer who does not exist.
 */
export const demoEscalations: Escalation[] = [
  /*
   * The evidence members the QC & Escalations detail draws are served: the
   * raiser line, the finished age label (a label, never a ticking clock),
   * the context paragraph, the docket excerpt split at the boxed match, the
   * debtor-vs-owner identity grid, and the QC seat. Null where a cluster
   * carries no such evidence — an ordinary state, not a placeholder.
   */
  {
    id: "esc_party_1",
    field_path_cluster: "judgments.hit_identity",
    order_ids: ["ord_demo_1"],
    question:
      "which of these 3 judgment hits is ours — same name, different case series",
    resolution: null,
    rule_id: null,
    resolved_by: null,
    raised_by: "R. Okafor · Judgments & Liens",
    age: "3h ago",
    context:
      "A judgment for $18,410 was indexed to a name matching the record owner on the General Execution Docket. Three hits share the caption across different case series. The rulebook prohibits auto-deciding party identity without explicit human confirmation.",
    excerpt: {
      doc_id: "doc_demo_1",
      page: 31,
      pre: "Case No. 26-J-04412. DISCOVER BANK, Plaintiff, v. ",
      hit: "SMITH, JOHN A.",
      post: ", Defendant… in the principal amount of $18,410.00.",
      note: "Source excerpt · p31 · line 9 · magnified",
    },
    identity: {
      debtor_label: "Judgment debtor of record",
      debtor: "SMITH, JOHN A.",
      owner_label: "Vested owner of subject parcel",
      owner: "QUENBY, MARLOWE D.",
    },
    qc_owner: "L. Vance",
  },
  {
    id: "esc_party_2",
    field_path_cluster: "judgments.hit_identity",
    order_ids: ["ord_demo_6"],
    question: "is this the same defendant? ours has middle initial only",
    resolution: null,
    rule_id: null,
    resolved_by: null,
    raised_by: "M. Okonkwo · Judgments & Liens",
    age: "5h ago",
    context: null,
    excerpt: null,
    identity: null,
    qc_owner: "L. Vance",
  },
  {
    id: "esc_party_3",
    field_path_cluster: "judgments.hit_identity",
    order_ids: ["ord_demo_1", "ord_demo_6"],
    question: "is a dismissed case still a hit?",
    resolution: null,
    rule_id: null,
    resolved_by: null,
    raised_by: "R. Okafor · Judgments & Liens",
    age: "1d ago",
    context: null,
    excerpt: null,
    identity: null,
    qc_owner: "L. Vance",
  },
  {
    id: "esc_hoa_1",
    field_path_cluster: "liens.hoa_age",
    order_ids: ["ord_demo_6"],
    question: "same HOA as the one above, why is this one out?",
    resolution: null,
    rule_id: null,
    resolved_by: null,
    raised_by: "M. Okonkwo · Encumbrances",
    age: "5h ago",
    context: null,
    excerpt: null,
    identity: null,
    qc_owner: "L. Vance",
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
    raised_by: "R. Okafor · Taxes",
    age: "settled",
    context: null,
    excerpt: null,
    identity: null,
    qc_owner: null,
  },
];

/** The two delivered orders and the one whose delivery bounced. */
const deliveredOrder = rowOrThrow("ord_demo_12");
const complainedOrder = rowOrThrow("ord_demo_13");
const bouncedOrder = rowOrThrow("ord_demo_8");

/**
 * Deliveries — a failed delivery is a transit state (attend), never a
 * quality state. v1 + v2 of the complained-about order are both retained:
 * the pair is the defect record. Every `report.order_id` names a row that
 * can hold one, and the terminal `delivered_at` is quoted from that row
 * rather than restated.
 */
export const demoDeliveries: DeliveryWithReport[] = [
  {
    id: "del_1",
    report_id: "rep_1",
    method: "email",
    status: "acknowledged",
    attempted_at: "2026-07-24T17:19:40Z",
    delivered_at: deliveredOrder.delivered_at,
    evidence: "smtp accepted · message-id 8812@demo",
    // The Transmission Receipt's four steps, per delivery, with the
    // server's own instants and attributions.
    receipt: [
      { id: "signed", at: "2026-07-24T17:19:38Z", what: "Release signed & sealed", who: "L. Vance · after QC countersign", done: true },
      { id: "digest", at: "2026-07-24T17:19:39Z", what: "SHA-256 digest recorded", who: "seal filed on the composition", done: true },
      { id: "transmit", at: "2026-07-24T17:19:40Z", what: "Transmitted · smtp", who: "smtp accepted · message-id 8812@demo", done: true },
      { id: "ack", at: "2026-07-24T17:21:02Z", what: "Client acknowledged receipt", who: "Riverbend Title portal · authorized user", done: true },
    ],
    report: {
      id: "rep_1",
      order_id: deliveredOrder.id,
      order_ref: refOf(deliveredOrder.id),
      version: 1,
      shape: "A",
      rendered_at: "2026-07-24T17:18:20Z",
      supersedes: null,
      reason: null,
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
    receipt: [
      { id: "signed", at: "2026-07-24T16:04:52Z", what: "Release signed & sealed", who: "L. Vance · after QC countersign", done: true },
      { id: "digest", at: "2026-07-24T16:04:53Z", what: "SHA-256 digest recorded", who: "seal filed on the composition", done: true },
      { id: "transmit", at: null, what: "Transmitted · client portal", who: "portal returned 503 · credential valid — retryable", done: false },
      { id: "ack", at: null, what: "Client acknowledged receipt", who: "not yet acknowledged", done: false },
    ],
    report: {
      id: "rep_2",
      order_id: bouncedOrder.id,
      order_ref: refOf(bouncedOrder.id),
      version: 1,
      shape: "A",
      rendered_at: "2026-07-24T16:02:20Z",
      supersedes: null,
      reason: null,
    },
  },
  {
    id: "del_3",
    report_id: "rep_3",
    method: "email",
    status: "transmitted",
    attempted_at: "2026-07-24T15:50:00Z",
    delivered_at: "2026-07-24T15:50:30Z",
    evidence: null,
    receipt: [
      { id: "signed", at: "2026-07-24T15:49:48Z", what: "Release signed & sealed", who: "L. Vance · after QC countersign", done: true },
      { id: "digest", at: "2026-07-24T15:49:49Z", what: "SHA-256 digest recorded", who: "seal filed on the composition", done: true },
      { id: "transmit", at: "2026-07-24T15:50:30Z", what: "Transmitted · smtp", who: "smtp accepted", done: true },
      { id: "ack", at: null, what: "Client acknowledged receipt", who: "not yet acknowledged", done: false },
    ],
    report: {
      id: "rep_3",
      order_id: complainedOrder.id,
      order_ref: refOf(complainedOrder.id),
      version: 1,
      shape: "B",
      rendered_at: "2026-07-24T15:48:10Z",
      supersedes: null,
      reason: null,
    },
  },
  {
    id: "del_4",
    report_id: "rep_4",
    method: "email",
    status: "acknowledged",
    attempted_at: "2026-07-24T17:19:00Z",
    delivered_at: complainedOrder.delivered_at,
    evidence: "after complaint · changed: judgments.1.type",
    receipt: [
      { id: "signed", at: "2026-07-24T17:18:55Z", what: "Reissue signed & sealed", who: "L. Vance · reason on ledger", done: true },
      { id: "digest", at: "2026-07-24T17:18:56Z", what: "SHA-256 digest recorded", who: "seal filed on the composition", done: true },
      { id: "transmit", at: "2026-07-24T17:19:00Z", what: "Transmitted · smtp", who: "smtp accepted", done: true },
      { id: "ack", at: "2026-07-24T17:22:41Z", what: "Client acknowledged receipt", who: "Riverbend Title portal · authorized user", done: true },
    ],
    report: {
      id: "rep_4",
      order_id: complainedOrder.id,
      order_ref: refOf(complainedOrder.id),
      version: 2,
      shape: "B",
      rendered_at: "2026-07-24T17:17:00Z",
      // The v1/v2 pair is the defect record: the v2 row states, on the
      // wire, which version it superseded and why.
      supersedes: 1,
      reason: "A value in the delivered report requires correction or updating",
    },
  },
];

/**
 * Complaints — grouped by how_it_got_through. An auto_confirmed complaint
 * means no human saw it: the threshold is wrong, not a reviewer. Every
 * `order_id` is an order that was actually delivered; `cmp_2` and `cmp_3`
 * sit on the same order as the v1/v2 delivery pair above — the complaint,
 * the re-render, and the rule are one record.
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

/*
 * Quote, don't restate — the live order's review and escalation lines
 * summarize `demoFields` and `demoEscalations`, so their numbers and
 * cluster names are derived from those stores rather than written beside
 * them. The decision census follows the definition the fields endpoint
 * states: settled is confirmed + corrected + escalated, queued is
 * needs_review, and the denominator is settled + queued — auto-confirmed
 * and pending fields were never anybody's decision.
 */
const liveFields = demoFields.filter((f) => f.order_id === liveOrder.id);
const liveQueued = liveFields.filter((f) => f.state === "needs_review").length;
const liveSettled = liveFields.filter(
  (f) => f.state === "confirmed" || f.state === "corrected" || f.state === "escalated",
).length;
// Open = unresolved. A pending rule would be quoted from the escalation's
// own `rule_id`, never asserted here.
const liveOpenEscalations = demoEscalations.filter(
  (e) => e.resolution === null && e.order_ids.includes(liveOrder.id),
);
const liveEscalationClusters = [
  ...new Set(liveOpenEscalations.map((e) => e.field_path_cluster)),
];

/**
 * Order timelines — the spine each order draws through the pipeline
 * (StatusRail). Server-authored in production; kinds stay an open
 * vocabulary until the FastAPI port. `attend: true` = amber on the rail.
 * Every timeline agrees with its row: the anchor timestamps and page counts
 * are quoted from it rather than restated.
 */
export const demoTimelines: Record<string, OrderTimelineEvent[]> = {
  [liveOrder.id]: [
    { at: liveOrder.arrived_at, kind: "arrived", label: "arrived", detail: `SFTP · ${liveOrder.jurisdiction}`, attend: false },
    { at: liveOrder.accepted_at ?? liveOrder.arrived_at, kind: "accepted", label: "accepted", detail: "signed R. Okafor", attend: false },
    { at: "2026-07-24T13:41:00Z", kind: "extracted", label: "extracted", detail: `${PACKAGE_PAGES_RELEVANT} relevant pages · 2 engines`, attend: false },
    { at: "2026-07-24T15:02:00Z", kind: "review", label: `review ${liveSettled}/${liveSettled + liveQueued}`, detail: `${liveQueued} fields queued`, attend: false },
    { at: "2026-07-24T15:20:00Z", kind: "escalated", label: `escalations open — ${liveOpenEscalations.length}`, detail: liveEscalationClusters.length === 0 ? null : liveEscalationClusters.join(" · "), attend: liveOpenEscalations.length > 0 },
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
 * The timelines as seeded, deep-copied before any handler runs: the
 * countersign handler (design.ts) appends live events to `demoTimelines`,
 * and the demo reset has to be able to take them back off.
 */
const timelineSeed: Record<string, OrderTimelineEvent[]> = Object.fromEntries(
  Object.entries(demoTimelines).map(([id, events]) => [id, events.map((e) => ({ ...e }))]),
);

/** Restore `demoTimelines` to its seed. Called by `POST /api/demo/reset`. */
export function resetDemoTimelines(): void {
  for (const id of Object.keys(demoTimelines)) {
    // Live handlers may have added keys the seed never held.
    delete demoTimelines[id];
  }
  for (const [id, events] of Object.entries(timelineSeed)) {
    demoTimelines[id] = events.map((e) => ({ ...e }));
  }
}

/**
 * Source page text for ord_demo_1. Clearly synthetic, and deliberately
 * consistent with `demoFields`: every cited page here is one a field cites.
 * The total is quoted from the order's own package size, and the one extra
 * entry (n:18, `read_in_full: false`) exists so the coverage spine can
 * exercise "present but not fully read" as distinct from "absent from the
 * array". This array is a sample of the package, not the package — nothing
 * may count it to learn how much was read; `PACKAGE_PAGES_RELEVANT` is that
 * number.
 */
export const demoPages: Record<
  string,
  {
    total: number;
    pages: { n: number; read_in_full: boolean; kind: string; lines: string[]; degraded: boolean }[];
    /**
     * The partitioner's own boundaries, not a grouping of `pages[].kind`
     * (see `PackageInstrument`). The ranges cover the package contiguously —
     * 1 through `total`, ascending, no overlap and no hole. `pages[]` is a
     * sample of the text; this is the whole package, described.
     */
    instruments: PackageInstrument[];
  }
> = {
  ord_real_1: {
    total: realPackage.total,
    pages: realPackage.pages,
    instruments: realPackage.instruments,
  },
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
        "",
        "IN WITNESS WHEREOF, the Grantor has executed this ____ day of ____, 2019.",
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
      { n: 30, read_in_full: true, degraded: true, kind: "FIFA SEARCH — SUPERIOR COURT", lines: [
        "IN THE SUPERIOR COURT OF CLAYTON COUNTY",
        "STATE OF GEORGIA · CIVIL DIVISION",
        "",
        "MERIDIAN FUNDING LLC, Plaintiff,",
        "v.",
        "M. QUENBY, Defendant.",
        "",
        "CASE NO. [ microfilm frame degraded — density loss ]",
        "JUDGMENT entered in the sum of $4,112.83",
      ] },
    ],
    instruments: [
      { id: "ins_cover", kind: "cover", label: "Search package cover & abstractor certification", first_page: 1, last_page: 5, recorded_ref: null },
      { id: "ins_deed", kind: "deed", label: "Warranty Deed — Huntcrest Builders LLC to Quenby", first_page: 6, last_page: 11, recorded_ref: "BK 10944 PG 213" },
      { id: "ins_secdeed", kind: "security_deed", label: "Security Deed — Quenby to Southstone Mortgage LLC", first_page: 12, last_page: 17, recorded_ref: "BK 10944 PG 218" },
      { id: "ins_plat", kind: "plat", label: "Plat reference — cover sheet only", first_page: 18, last_page: 21, recorded_ref: null },
      { id: "ins_tax", kind: "tax_card", label: "Clayton County tax commissioner card", first_page: 22, last_page: 27, recorded_ref: "PARCEL 13-0044-0018" },
      { id: "ins_fedlien", kind: "lien_search", label: "Federal tax lien search — nothing of record", first_page: 28, last_page: 28, recorded_ref: null },
      // The docket reference is what `fld_j1case` is queued about: the
      // frame is below the contrast floor, so the partitioner drew the
      // boundary and recorded no reference. `null` is that.
      { id: "ins_fifa", kind: "judgment", label: "FiFa search — Superior Court of Clayton County", first_page: 29, last_page: 34, recorded_ref: null },
      { id: "ins_index", kind: "index", label: "Grantor / grantee chain index", first_page: 35, last_page: 64, recorded_ref: null },
    ],
  },
};
