import { http, HttpResponse } from "msw";
import type {
  CompositionResponse,
  Countersign,
  DeliveryWithReport,
  JurisdictionResponse,
  OrderFilter,
  OrderRow,
  OrdersPageResponse,
  QuarantineResponse,
  ReissueResponse,
  TemplateResponse,
  CaptureScheduleResponse,
  ArtifactsResponse,
  CountersignsResponse,
} from "@titlepipe/contract";
import { demoOrders, demoDeliveries, demoFields } from "./data.js";
import { guard } from "./guard.js";

/** Handlers for the surface added under the 2026-08-28 ruling. */

const ASSIGNEES: Readonly<Record<string, string | null>> = {
  gate: "R. Okafor",
  review: "D. Okafor",
  escalated: "L. Vance",
  intake: "R. Delacroix",
  machine: null,
  unassigned: null,
  delivered: "D. Okafor",
};

const DUE: Readonly<Record<string, string | null>> = {
  gate: "today",
  review: "today",
  escalated: "tomorrow",
  intake: "tomorrow",
  machine: "in 2 days",
  unassigned: "unscheduled",
  delivered: null,
};

function toRow(o: (typeof demoOrders)[number]): OrderRow {
  return {
    id: o.id,
    order_ref: o.order_ref,
    addr: o.addr,
    place: o.place,
    client: "Riverbend Title",
    product: o.product,
    stage: o.stage as OrderRow["stage"],
    assigned_to: ASSIGNEES[o.stage] ?? null,
    due: DUE[o.stage] ?? null,
    pages: o.pages,
  };
}

const PAGE_SIZE = 10;

function matches(row: OrderRow, q: string): boolean {
  if (q === "") return true;
  const norm = (s: string) => s.toLowerCase();
  const digits = (s: string) => norm(s).replace(/[^a-z0-9]/g, "");
  const fields: Record<string, string> = {
    ref: digits(row.order_ref),
    address: norm(row.addr),
    client: norm(row.client),
    stage: norm(row.stage),
    product: norm(row.product),
    assigned: norm(row.assigned_to ?? ""),
  };
  return norm(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => {
      const scoped = /^([a-z]+):(.+)$/.exec(term);
      if (scoped && fields[scoped[1] ?? ""] !== undefined) {
        const key = scoped[1] ?? "";
        const want = key === "ref" ? digits(scoped[2] ?? "") : (scoped[2] ?? "");
        return (fields[key] ?? "").includes(want);
      }
      return Object.values(fields).some((v) => v.includes(term));
    });
}

function inFilter(row: OrderRow, f: OrderFilter): boolean {
  if (f === "all") return true;
  if (f === "delivered") return row.stage === "delivered";
  if (f === "waiting") return row.stage === "gate" || row.stage === "escalated";
  return row.stage !== "delivered";
}

/**
 * THE ORDER WHOSE GATES ARE GREEN. Quoted from the fixture table rather than
 * written as a literal, for the reason `FIELDS_ORDER_ID` is quoted in
 * `handlers.ts`: a second copy of an id is a second answer.
 */
const CLEARED_ORDER_ID = "ord_demo_14";

/**
 * THE ORDER THE FIELD FIXTURE DESCRIBES — quoted from `demoFields` for the
 * reason `CLEARED_ORDER_ID` is quoted from the order table: a second copy of
 * an id is a second answer. (`handlers.ts` quotes the same cell as
 * `FIELDS_ORDER_ID`; it imports this module, so it cannot be imported here.)
 */
const REVIEW_ORDER_ID = demoFields[0]?.order_id ?? "";

type CountersignRow = CountersignsResponse["required"][number];

/**
 * The design's second reader for the cleared order — the "Switch user:
 * R. Menon (QC)" seat. Written once so the countersign row and gate g4's
 * "countersigned by …" detail cannot name two different people.
 */
const CLEARED_SECOND_READER = "R. Menon (QC)";

/**
 * THE T1 SECOND-READ LEDGER, PER ORDER.
 *
 * One store answers both `GET /orders/:id/countersigns` and gate g4 on the
 * composition, so the two endpoints cannot tell different stories about one
 * order. Until 2026-08-29 every order was served the review order's three
 * outstanding rows while `clearedComposition` swore ord_demo_14's gate was
 * already "countersigned by R. Menon (QC)" — one order, two answers.
 *
 * Mutable for the reason `seals` is: a filed countersign has to survive the
 * request that filed it, or the row could be second-read twice. Reset on
 * reload, like every other mutation in this package.
 *
 * An order with no entry has no T1-tagged rulings — the empty list is the
 * true answer for it, not a placeholder.
 */
const countersignStore = new Map<string, CountersignRow[]>([
  [
    REVIEW_ORDER_ID,
    // The three ruinous-exposure rulings 4176034-1 still owes a second read —
    // the count blockedComposition's gate g4 quotes.
    [
      { field_id: "fld_jgmt_hit", path: "judgments.1.hit_identity", value: "SMITH, JOHN A.", ruled_by: "L. Vance", countersigned_by: null },
      { field_id: "fld_mtg_amount", path: "mortgages.1.amount", value: "$412,000", ruled_by: "L. Vance", countersigned_by: null },
      { field_id: "fld_legal_desc", path: "legal.description", value: "Lot 14, Block C", ruled_by: "L. Vance", countersigned_by: null },
    ],
  ],
  [
    CLEARED_ORDER_ID,
    // The one ruinous exposure 4176028-5's own sheet states — block IV's open
    // security deed to Ashfield Savings — already second-read, which is what
    // its cleared gate g4 asserts. Ruled by the examiner the order table
    // assigns the seat (D. Okafor); countersigned by the QC second reader.
    [
      { field_id: "fld_14_lender", path: "mortgages.1.lender", value: "Ashfield Savings", ruled_by: "D. Okafor", countersigned_by: CLEARED_SECOND_READER },
    ],
  ],
]);

/**
 * Gate g4, QUOTED from the ledger rather than restated beside it: passed is
 * "no row still open", and the detail names either the open count or the
 * signers the rows actually carry.
 */
function t1Gate(orderId: string): { passed: boolean; detail: string | null } {
  const rows = countersignStore.get(orderId) ?? [];
  const open = rows.filter((r) => r.countersigned_by === null).length;
  if (open > 0) {
    return {
      passed: false,
      detail: open === 1 ? "1 ruling awaits a second examiner" : `${String(open)} rulings await a second examiner`,
    };
  }
  const signers = [...new Set(rows.flatMap((r) => (r.countersigned_by === null ? [] : [r.countersigned_by])))];
  return {
    passed: true,
    detail: signers.length === 0 ? null : `countersigned by ${signers.join(", ")}`,
  };
}

/**
 * THE DELIVERY LEDGER THIS FILE MUTATES — the rows `GET /api/deliveries`
 * serves and the version ledger reads.
 *
 * `handlers.ts` keeps its own copy of `demoDeliveries` for the list and for
 * retry, but a reissue has to APPEND a draft row that the same list then
 * shows, and `handlers.ts` imports this module — the cycle `guard.ts`
 * documents — so its store cannot be imported here. `designHandlers` are
 * spread AHEAD of `handlers.ts`'s own in the assembled array and MSW resolves
 * the first match, so this store is the one the wire serves: the GET and
 * retry handlers below shadow the ones in `handlers.ts` precisely so every
 * reader and every writer of a delivery touches the same rows. One store,
 * one answer.
 */
const deliveryStore: DeliveryWithReport[] = demoDeliveries.map((d) => ({
  ...d,
  report: d.report ? { ...d.report } : null,
}));
let reissueCount = 0;

/**
 * SEALS FILED THIS PAGE SESSION, `order_id` → digest.
 *
 * The seal is what makes a release IRREVERSIBLE, so it has to survive the
 * request that made it — a handler that recomputed `seal_sha256: null` on the
 * next read would let the same order be released twice, and the second release
 * is the exact act `releaseHold` refuses on. Reset on reload, like every other
 * mutation in this package.
 */
const seals = new Map<string, { sha256: string; at: string; version: number }>();

const composition = (orderId: string): CompositionResponse =>
  orderId === CLEARED_ORDER_ID ? clearedComposition(orderId) : blockedComposition(orderId);

/**
 * 4176028-5 — every gate answered, and the sheet is releasable until it is
 * released. Once it is, `seal_sha256` is the server's record that it happened.
 */
function clearedComposition(orderId: string): CompositionResponse {
  const filed = seals.get(orderId) ?? null;
  return {
    order_id: orderId,
    template_version: "v4.2",
    blocks: [
      { id: "b1", numeral: "I", title: "Header information", body: "Order 4176028-5 · Clayton County, GA · two-owner search.", field_count: 6, cited: 6 },
      { id: "b2", numeral: "II", title: "Property identification", body: "310 Wrenfield Ln, Demoville GA · parcel 13-0044-0231.", field_count: 5, cited: 5 },
      { id: "b3", numeral: "III", title: "Vesting & title chain", body: "Adaline P. Rooke, by warranty deed from Wrenfield Homes LLC.", field_count: 7, cited: 7 },
      { id: "b4", numeral: "IV", title: "Encumbrances & open liens", body: "One open security deed to Ashfield Savings. No other liens of record.", field_count: 6, cited: 6 },
      { id: "b5", numeral: "V", title: "Tax assessment & status", body: "2025 installment paid in full. Land 31,500 · building 142,900.", field_count: 4, cited: 4 },
      { id: "b6", numeral: "VI", title: "Judgments & general liens", body: "Searched. Nothing indexed against the owner of record.", field_count: 3, cited: 3 },
      { id: "b7", numeral: "VII", title: "Provenance & audit trail", body: "Every value carries a page and line citation.", field_count: 2, cited: 2 },
    ],
    gates: [
      { id: "g1", label: "Every flagged decision answered", passed: true, detail: null },
      { id: "g2", label: "Every value carries a citation", passed: true, detail: null },
      { id: "g3", label: "Chain of title unbroken through the statutory period", passed: true, detail: null },
      // Quoted from the countersign ledger — the same rows
      // `GET /orders/:id/countersigns` serves for this order.
      { id: "g4", label: "T1 second read countersigned", ...t1Gate(orderId) },
      { id: "g5", label: "Completeness gate cleared", passed: true, detail: null },
    ],
    // Released once. A sealed sheet is no longer releasable, and the server
    // says so in its own sentence rather than leaving the client to infer it
    // from the digest.
    releasable: filed === null,
    blocked_reason:
      filed === null
        ? null
        : "This order was released and sealed. A release files once; a further copy is a reissue, not a release.",
    seal_sha256: filed?.sha256 ?? null,
  };
}

function blockedComposition(orderId: string): CompositionResponse {
  const gates: CompositionResponse["gates"] = [
    { id: "g1", label: "Every flagged decision answered", passed: false, detail: "6 still open" },
    { id: "g2", label: "Every value carries a citation", passed: false, detail: "1 value has no provenance" },
    { id: "g3", label: "Chain of title unbroken through the statutory period", passed: true, detail: null },
    /*
     * Quoted from the review order's countersign ledger, whatever id this
     * sheet is served under: the blocked composition IS 4176034-1's sheet
     * (its blocks name the order), reused as the fixture's stand-in for every
     * order that is not cleared. Restating "3 rulings await" as a literal here
     * is how it and the countersigns endpoint drifted apart.
     */
    { id: "g4", label: "T1 second read countersigned", ...t1Gate(REVIEW_ORDER_ID) },
    { id: "g5", label: "Completeness gate cleared", passed: false, detail: "package contradicts the intake sign-off" },
  ];
  // The count is the gate list's, not a restated numeral — filing the three
  // countersigns live closes g4, and the sentence must not go on saying four.
  const open = gates.filter((g) => !g.passed).length;
  return {
  order_id: orderId,
  template_version: "v4.2",
  blocks: [
    { id: "b1", numeral: "I", title: "Header information", body: "Order 4176034-1 · Clayton County, GA · 40-year search.", field_count: 6, cited: 6 },
    { id: "b2", numeral: "II", title: "Property identification", body: "4152 Creekstone Dr, Demoville GA · parcel 13-0044-0018.", field_count: 5, cited: 5 },
    { id: "b3", numeral: "III", title: "Vesting & title chain", body: "Marlowe D. Quenby and Tessa R. Quenby, by warranty deed.", field_count: 7, cited: 7 },
    { id: "b4", numeral: "IV", title: "Encumbrances & open liens", body: "One open security deed. One HOA lien, suppressed under R13.", field_count: 9, cited: 8 },
    { id: "b5", numeral: "V", title: "Tax assessment & status", body: "2025 installment paid. Land 28,000 · building 158,400.", field_count: 4, cited: 4 },
    { id: "b6", numeral: "VI", title: "Judgments & general liens", body: "One indexed judgment, party identity escalated.", field_count: 3, cited: 2 },
    { id: "b7", numeral: "VII", title: "Provenance & audit trail", body: "Every value carries a page and line citation.", field_count: 2, cited: 2 },
  ],
  gates,
  releasable: false,
  blocked_reason: `${String(open)} gate${open === 1 ? " is" : "s are"} open. The report cannot compose until each is answered.`,
  seal_sha256: null,
  };
}

/**
 * A stable 64-hex digest per fixture artifact. It is NOT a hash of any file —
 * nothing here renders a PDF — but it has to differ per version, because two
 * versions sharing a digest would say the reissue changed nothing.
 */
const fixtureDigest = (seed: string): string => {
  let a = 0x811c9dc5;
  let out = "";
  for (let i = 0; out.length < 64; i += 1) {
    for (const ch of `${seed}#${String(i)}`) {
      a = Math.imul(a ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    }
    out += a.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
};

export const designHandlers = [
  http.get("/api/orders", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const filter = (url.searchParams.get("filter") ?? "all") as OrderFilter;
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const rows = demoOrders.map(toRow).filter((r) => inFilter(r, filter) && matches(r, q));
    const page_count = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const clamped = Math.min(page, page_count);
    const body: OrdersPageResponse = {
      orders: rows.slice((clamped - 1) * PAGE_SIZE, clamped * PAGE_SIZE),
      total: rows.length,
      page: clamped,
      page_size: PAGE_SIZE,
      page_count,
      query: q,
      filter,
    };
    return HttpResponse.json(body);
  }),

  http.get("/api/orders/:id/composition", ({ params }) =>
    HttpResponse.json(composition(String(params["id"]))),
  ),

  http.post("/api/orders/:id/release", async ({ params, request }) => {
    const denied = guard(request, "release.execute");
    if (denied) return denied;
    const orderId = String(params["id"]);
    const body = (await request.json()) as { signature?: string };
    // Unsigned is refused BEFORE the gates, for every order: an unsigned act
    // never reaches a gate to be judged by it.
    if (!body?.signature) {
      return HttpResponse.json({ error: "a release is refused without its signature" }, { status: 422 });
    }
    if (orderId !== CLEARED_ORDER_ID) {
      // The count is the composition's own — quoted, so a countersign filed
      // live cannot leave this sentence claiming a gate that since closed.
      const open = blockedComposition(orderId).gates.filter((g) => !g.passed).length;
      return HttpResponse.json(
        { error: `${open === 1 ? "one gate is" : `${String(open)} gates are`} open — the release gate refuses` },
        { status: 409 },
      );
    }
    if (seals.has(orderId)) {
      return HttpResponse.json(
        { error: "this order is already released and sealed — a release files once" },
        { status: 409 },
      );
    }
    // The digest is over the composed manifest, which is what the seal claims
    // to fix. Seeded from the blocks so it could not be mistaken for a nonce.
    const filed = {
      sha256: fixtureDigest(
        clearedComposition(orderId)
          .blocks.map((b) => `${b.numeral}:${b.title}:${b.body}`)
          .join("|"),
      ),
      at: new Date().toISOString(),
      version: 1,
    };
    seals.set(orderId, filed);
    return HttpResponse.json({
      order_id: orderId,
      version: filed.version,
      seal_sha256: filed.sha256,
      released_at: filed.at,
    });
  }),

  /*
   * One artifact per report actually delivered for this order, so an order with
   * a v1 and a v2 has two rows and each joins to its own report. Before this
   * every order got a single `rep_1` row carrying one shared digest — a hash
   * that hashed nothing and a join that landed on another order's report.
   *
   * Read from `demoDeliveries` — the immutable released record — and NOT from
   * `deliveryStore`, deliberately: a reissue DRAFT lives only in the store,
   * and a draft has no certified artifact until it releases.
   */
  http.get("/api/orders/:id/artifacts", ({ params }) => {
    const orderId = String(params["id"]);
    const body: ArtifactsResponse = {
      artifacts: demoDeliveries
        .flatMap((delivery) => {
          // A delivery whose report never rendered has no artifact to certify.
          const report = delivery.report;
          if (report === null || report.order_id !== orderId) return [];
          return [{
            id: `art_${delivery.report_id}`,
            report_id: delivery.report_id,
            filename: `${orderId}-title-report-v${String(report.version)}.pdf`,
            media_type: "application/pdf",
            bytes: 486_112 + report.version * 2_048,
            sha256: fixtureDigest(`${delivery.report_id}:v${String(report.version)}`),
            href: `/api/artifacts/art_${delivery.report_id}`,
          }];
        }),
    };
    return HttpResponse.json(body);
  }),

  /*
   * The delivery list and retry, served off the SAME store the reissue below
   * appends to. These two shadow their `handlers.ts` twins (see the note on
   * `deliveryStore`): a reissue that mutated a store the list never reads
   * would file a version nobody can see.
   */
  http.get("/api/deliveries", () => HttpResponse.json({ deliveries: deliveryStore })),

  /** Retry re-SENDS the same file — the report is never re-rendered. */
  http.post("/api/deliveries/:id/retry", ({ params, request }) => {
    const denied = guard(request, "delivery.retry");
    if (denied) return denied;
    const d = deliveryStore.find((x) => x.id === params["id"]);
    if (!d) return HttpResponse.json({ error: "no such delivery" }, { status: 404 });
    d.status = "delivered";
    d.delivered_at = new Date().toISOString();
    d.evidence = "delivered on retry — same file, same report version";
    return HttpResponse.json({ ok: true });
  }),

  /*
   * REISSUE — Law 9's one licensed act on a released version. Until
   * 2026-08-29 the reason check fell through to "no released version to
   * supersede" for EVERY delivery, while the store above holds delivered
   * v1s — the refusal contradicted the fixture it guards. The rule, made
   * true:
   *   - a delivery whose report exists names a released version; the reissue
   *     opens the next version as a DRAFT row the version ledger reads, with
   *     the stated reason on the row (`evidence` carries it — `Report` has no
   *     `reissue_reason` member yet; `VersionLedger.tsx` records that gap);
   *   - ONE-WAY: while that draft is open the gateway is closed — a draft is
   *     not a released version, so there is nothing further to supersede;
   *   - a delivery with no report keeps the refusal verbatim: there truly is
   *     no released version behind it.
   */
  http.post("/api/deliveries/:id/reissue", async ({ params, request }) => {
    const denied = guard(request, "delivery.reissue");
    if (denied) return denied;
    const body = (await request.json()) as { reason?: string };
    if (!body?.reason) {
      return HttpResponse.json({ error: "a reissue is refused without its reason" }, { status: 422 });
    }
    const target = deliveryStore.find((d) => d.id === String(params["id"]));
    if (target === undefined || target.report === null) {
      return HttpResponse.json({ error: "this order has no released version to supersede" }, { status: 409 });
    }
    const released = target.report;
    const versions = deliveryStore.filter((d) => d.report?.order_id === released.order_id);
    if (versions.some((d) => d.status === "draft")) {
      return HttpResponse.json(
        { error: "a reissue draft is already open for this order — a draft is not a released version, and only a released version can be superseded" },
        { status: 409 },
      );
    }
    // Supersedes the order's HIGHEST version, whichever row was posted — the
    // server's arithmetic, not the client's row choice.
    const supersedes = versions.reduce((max, d) => Math.max(max, d.report?.version ?? 0), 0);
    reissueCount += 1;
    const report = {
      id: `rep_reissue_${String(reissueCount)}`,
      order_id: released.order_id,
      version: supersedes + 1,
      shape: released.shape,
      rendered_at: new Date().toISOString(),
    };
    deliveryStore.push({
      id: `del_reissue_${String(reissueCount)}`,
      report_id: report.id,
      method: target.method,
      status: "draft",
      // A draft has been transmitted to nobody — both instants are honestly null.
      attempted_at: null,
      delivered_at: null,
      evidence: `reissue draft · reason: ${body.reason}`,
      report,
    });
    const res: ReissueResponse = { report, supersedes, reason: body.reason };
    return HttpResponse.json(res);
  }),

  // Per order, off the ledger — the same rows gate g4 quotes. An order the
  // ledger has no entry for owes no second read, and the empty list says so.
  http.get("/api/orders/:id/countersigns", ({ params }) => {
    const orderId = String(params["id"]);
    const body: CountersignsResponse = {
      order_id: orderId,
      required: countersignStore.get(orderId) ?? [],
    };
    return HttpResponse.json(body);
  }),

  /*
   * DESIGN RULE 13, ENFORCED RATHER THAN RECITED. Until 2026-08-29 this
   * handler answered the same-examiner 409 unconditionally — the refusal
   * existed and the act it guards did not, so "Switch user: R. Menon (QC)"
   * led nowhere. The acting examiner is the authenticated identity:
   * `x-mock-actor` stands in for the session/JWT claim, the same convention
   * `handlers.ts` uses to sign golden corrections — never the typed
   * signature, which is a client field.
   */
  http.post("/api/fields/:id/countersign", async ({ params, request }) => {
    const denied = guard(request, "field.countersign");
    if (denied) return denied;
    const body = (await request.json()) as { signature?: string };
    if (!body?.signature) {
      return HttpResponse.json({ error: "a countersign is refused without a signature" }, { status: 422 });
    }
    const fieldId = String(params["id"]);
    let row: CountersignRow | undefined;
    for (const rows of countersignStore.values()) {
      row = rows.find((r) => r.field_id === fieldId);
      if (row !== undefined) break;
    }
    if (row === undefined) {
      return HttpResponse.json({ error: "no countersign is required on this field" }, { status: 404 });
    }
    if (row.countersigned_by !== null) {
      return HttpResponse.json(
        { error: "this ruling already carries its second read — a countersign files once" },
        { status: 409 },
      );
    }
    // An unidentified actor cannot PROVE a second pair of eyes, so a missing
    // identity refuses exactly as the ruling examiner does.
    const actor = request.headers.get("x-mock-actor");
    if (actor === null || actor === row.ruled_by) {
      return HttpResponse.json(
        { error: "a second read must come from a different examiner than the one who ruled" },
        { status: 409 },
      );
    }
    row.countersigned_by = actor;
    const filed: Countersign = {
      id: `cs_${fieldId}`,
      field_id: fieldId,
      ruled_by: row.ruled_by,
      countersigned_by: actor,
      at: new Date().toISOString(),
    };
    return HttpResponse.json(filed);
  }),

  http.get("/api/orders/:id/quarantine", ({ params }) => {
    const body: QuarantineResponse = {
      order_id: String(params["id"]),
      sha256: "8e2f1d9a04cb6831b7c2a51e0d47f39a6c81b2e5470af9d3c6182b47e72df890",
      duplicate_of: null,
      steps: [
        { id: "av", label: "Antivirus scan", state: "passed", detail: "clean" },
        { id: "pdf", label: "Real-PDF check", state: "passed", detail: "64 pages, no embedded script" },
        { id: "sha", label: "SHA-256 digest", state: "passed", detail: "no prior intake with this digest" },
      ],
      optical: [
        { id: "dpi", label: "Raster resolution", value: "300 DPI · bitonal", ok: true, note: null },
        { id: "stamp", label: "Clerk stamp located", value: "p1 · Clayton County Superior Court", ok: true, note: null },
        { id: "contrast", label: "Contrast floor", value: "3 pages below", ok: false, note: "p7, p22, p29 — flagged under Law 3" },
      ],
    };
    return HttpResponse.json(body);
  }),

  http.get("/api/templates", () => {
    const body: TemplateResponse = {
      version: "v4.2",
      blocks: [
        { id: "t1", numeral: "I", title: "Header information", included: true, note: "Order, jurisdiction, product, period" },
        { id: "t2", numeral: "II", title: "Property identification", included: true, note: "Situs, parcel, legal description" },
        { id: "t3", numeral: "III", title: "Vesting & title chain", included: true, note: "Current owner and the chain behind them" },
        { id: "t4", numeral: "IV", title: "Encumbrances & open liens", included: true, note: "Mortgages, HOA, mechanics" },
        { id: "t5", numeral: "V", title: "Tax assessment & status", included: true, note: "Assessed values and installment status" },
        { id: "t6", numeral: "VI", title: "Judgments & general liens", included: true, note: "Indexed judgments against the owner" },
        { id: "t7", numeral: "VII", title: "Provenance & audit trail", included: false, note: "Internal shape only — not on client copies" },
      ],
      samples: [
        { client_id: "cli_riverbend", client: "Riverbend Title", shape: "A", lines: 13 },
        { client_id: "cli_hollowyn", client: "Hollowyn Abstract", shape: "B", lines: 16 },
      ],
      export_spec: '{\n  "version": "v4.2",\n  "blocks": 7,\n  "shapes": ["A", "B"]\n}',
    };
    return HttpResponse.json(body);
  }),

  http.get("/api/blind/:order/schedule", ({ params }) => {
    const body: CaptureScheduleResponse = {
      order_id: String(params["order"]),
      seat: "seat-a",
      pages: 64,
      sections: [
        {
          id: "header", title: "Header information",
          fields: [
            { path: "header.order_ref", label: "Order reference", kind: "text", options: [], required: true },
            { path: "header.county", label: "County of record", kind: "text", options: [], required: true },
            { path: "header.search_from", label: "Search period from", kind: "date", options: [], required: true },
          ],
        },
        {
          id: "property", title: "Property identification",
          fields: [
            { path: "property.situs", label: "Situs address", kind: "text", options: [], required: true },
            { path: "property.parcel", label: "Tax parcel id", kind: "text", options: [], required: true },
            { path: "property.legal_lot", label: "Legal lot", kind: "text", options: [], required: false },
          ],
        },
        {
          id: "vesting", title: "Vesting & title chain",
          fields: [
            { path: "vesting.owner", label: "Current owner of record", kind: "text", options: [], required: true },
            { path: "vesting.deed_type", label: "Vesting instrument", kind: "select", options: ["Warranty deed", "Quitclaim deed", "Security deed"], required: true },
            { path: "vesting.recorded", label: "Recorded", kind: "date", options: [], required: true },
          ],
        },
        {
          id: "liens", title: "Encumbrances & open liens",
          fields: [
            { path: "liens.1.holder", label: "Lien holder", kind: "text", options: [], required: false },
            { path: "liens.1.amount", label: "Amount", kind: "money", options: [], required: false },
          ],
        },
      ],
    };
    return HttpResponse.json(body);
  }),

  http.get("/api/jurisdictions/:code", ({ params }) => {
    const code = String(params["code"]);
    const state = code.slice(-2).toUpperCase();
    const label =
      state === "GA" ? "Georgia" : state === "NY" ? "New York" : state === "NC" ? "North Carolina" : state;
    const body: JurisdictionResponse = {
      code,
      label,
      baseline_note:
        state === "GA"
          ? "Global baseline plus three Georgia overrides."
          : `Global baseline. No ${label} overrides are in force.`,
      rules: [
        { id: "j1", code: "GA-01", text: "Security deeds convey title; report as vesting instruments.", applies: state === "GA", scope_note: "Georgia only" },
        { id: "j2", code: "GA-02", text: "Plat references are reported from the plat book, not the deed.", applies: state === "GA", scope_note: "county of record only" },
        { id: "j3", code: "R13", text: "HOA liens report regardless of age unless expressly released.", applies: true, scope_note: null },
        { id: "j4", code: "NY-04", text: "Consolidated mortgages report as one instrument.", applies: state === "NY", scope_note: "New York only" },
        { id: "j5", code: "NC-02", text: "Deeds of trust name a trustee; report the trustee with the beneficiary.", applies: state === "NC", scope_note: "North Carolina only" },
      ],
      null_states: [
        { path: "legal.plat_book_page", label: "Plat book & page", reason: "NOT_PRESENT", renders_as: "N/A — expected in this jurisdiction" },
        { path: "judgments.1.case_no", label: "Judgment case number", reason: "NOT_FOUND", renders_as: "Searched — nothing of record" },
        { path: "vesting.consideration", label: "Consideration", reason: "NOT_STATED", renders_as: "Instrument silent" },
        { path: "assessment.city_tax", label: "City tax", reason: "PRESENT_UNREADABLE", renders_as: "Present — unreadable" },
      ],
    };
    return HttpResponse.json(body);
  }),
];
