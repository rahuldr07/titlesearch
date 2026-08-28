import { http, HttpResponse } from "msw";
import { workspaceHandlers } from "./workspace.js";
import { designHandlers } from "./design.js";
import {
  BlindEntriesRequest,
  ConfirmFieldRequest,
  CorrectFieldRequest,
  CreateBugRequest,
  CreateComplaintRequest,
  NaReason,
  EngineRoutingRequest,
  EscalateFieldRequest,
  ExcludeFieldRequest,
  GoldenAffirmRequest,
  GoldenCorrectionRequest,
  PassOrderRequest,
  ReconciliationRulingRequest,
  ResolveComplaintRequest,
  ResolveEscalationRequest,
  canDo,
  isRole,
  rulesFor,
  type Action,
  type Ack,
  type Engine,
  type Escalation,
  type Reconciliation,
  type Field,
  type OrderContextResponse,
  type OrderFieldsResponse,
  type PassOrderResponse,
  type QueueBandId,
  type QueueBandOrder,
  type QueueBandsResponse,
  type QueueNextResponse,
  type Rule,
} from "@titlepipe/contract";
import {
  demoComplaints,
  demoDeliveries,
  demoEscalations,
  demoFields,
  demoGolden,
  demoOrderEntity,
  demoOrderRow,
  demoOrders,
  demoPages,
  demoQueue,
  demoRules,
  demoTimelines,
  type DemoOrderRow,
} from "./data.js";

/**
 * MSW handlers serving the contract with demo data. These are deleted
 * route-by-route as the FastAPI core-api lands (frontend-first strategy,
 * HANDOFF §5). Handlers validate REQUESTS against the contract schemas so the
 * UI cannot drift from the refusal rules even while mocked — a correction
 * without a reason must fail here exactly as it will against the real server.
 *
 * Handlers are STATEFUL within a page session: mutations write the store and
 * reads return it, so the UI proves it renders server state verbatim rather
 * than optimistic local state.
 */

/**
 * The queue is SERVER-ordered (no cherry-pick). A recorded pass advances the
 * head, exactly like the real queue serving the next order. Pass counts and
 * 4th-pass auto-escalation stay server-side — nothing about them is exposed.
 *
 * PROJECTED FROM THE ONE SHARED ORDER SET, never restated. The order of service
 * is `demoQueue`'s (`queue_position` ascending), which is data on the row rather
 * than an accident of this array's literal order — this file used to name two
 * singletons and the lifecycle board named its own, and the two disagreed about
 * what state 4176034-1 was in.
 */
const queue = demoQueue.map(demoOrderEntity);
let queueHead = 0;

/**
 * The band headings and their sub-lines, the 2026-07-28 export's own
 * (`TitlePipe.dc.html:219-220`, `:268-269`, `:298-299`, `:319-320`). Served
 * rather than held in the browser for the same reason `LifecycleStamp.label`
 * is: a client-side `Record<QueueBandId, string>` is a second copy of product
 * copy, and a second copy drifts silently from the first.
 *
 * The export's sub-line interpolates the count into the sentence
 * (`{{ queueHeldCount }} stopped · needs someone`). It does not here: `count`
 * is its own served field, and a number baked into a string is a number no
 * consumer can read without parsing prose.
 */
const BAND_COPY: Record<QueueBandId, { title: string; note: string }> = {
  mine: { title: "Mine", note: "in progress" },
  held: { title: "Held", note: "stopped · needs someone" },
  in_flight: { title: "In flight", note: "processing · senior · ops view" },
  delivered: { title: "Recently delivered", note: "get back to a recent one" },
};

/**
 * A row as the band lists it. Deliberately NARROWER than the order: no claim
 * token, no assignment, no priority, no ordering the caller can influence.
 * `/api/queue/next` stays the only hand-over, so §4.4's "no queue
 * cherry-picking" holds by construction rather than by the screen's restraint.
 */
function bandRow(row: DemoOrderRow): QueueBandOrder {
  return {
    id: row.id,
    order_ref: row.order_ref,
    addr: row.addr,
    place: row.place,
    waited: row.waited,
    waiting_on: row.waiting_on,
    state_label: row.state_label,
    mine: row.mine,
  };
}

/**
 * The role gate is the SHOP'S, not the screen's: a reviewer's Held list is
 * narrowed to their own orders and the In flight band is absent entirely —
 * absent, not dimmed, because an absent band and an empty band are different
 * statements and only the server can tell them apart.
 *
 * `count` is the census of the whole band and stays what it is when the row
 * list narrows. That is the whole reason it is served rather than derived: a
 * count that shrank with your permissions would read as work disappearing
 * rather than as work you are not allowed to look at. It is a count of what is
 * left and never a rate — there is no per-hour, per-person or per-period figure
 * in this shape and §4.5 means there never may be.
 */
export function queueBandsFor(role: string): QueueBandsResponse {
  const senior = role !== "reviewer";
  const ids: QueueBandId[] = senior
    ? ["mine", "held", "in_flight", "delivered"]
    : ["mine", "held", "delivered"];
  return {
    bands: ids.map((id) => {
      const all = demoOrders.filter((r) => r.band === id);
      const visible = id === "held" && !senior ? all.filter((r) => r.mine) : all;
      return {
        id,
        ...BAND_COPY[id],
        count: all.length,
        orders: visible.map(bandRow),
      };
    }),
  };
}

/**
 * The order-scoped lookup every screen below `/orders/{id}` needed and no
 * endpoint offered: the human reference for an order you hold only the URL id
 * of, plus what was ordered, over what span, in how many pages, and the
 * SERVER'S WORD for where it stands.
 *
 * The stamp arrives already decided. The export computes that word from a
 * five-branch `if/else` in the browser (`TitlePipe.dc.html:2888-2893`); that is
 * a client-side lifecycle state machine and hard rule 3 puts state machines on
 * the server.
 *
 * An unknown order THROWS rather than returning a placeholder — a context
 * response that quietly names nothing is how a screen ends up printing a ref
 * that belongs to no order. The route turns that into a 404.
 */
export function orderContextFor(orderId: string): OrderContextResponse {
  const row = demoOrderRow(orderId);
  if (row === undefined) throw new Error(`no such order: ${orderId}`);
  return {
    order_id: row.id,
    order_ref: row.order_ref,
    product: row.product,
    period_label: row.period,
    pages: row.pages,
    stamp: { label: row.stamp_label, tone: row.stamp_tone },
  };
}

/**
 * Source pages. Text, not rasters — the review screen shows WHERE a value came
 * from, and the recorded line coordinates index into this text.
 */
const pagesHandler = http.get("/api/orders/:id/pages", ({ params }) => {
  const id = String(params["id"]);
  const doc = demoPages[id];
  /* An order with no package fixture has no partition to report. `[]` is that
     answer, and it is not the same claim as "one instrument spanning
     everything" — which is what grouping the empty `pages[]` would produce. */
  return HttpResponse.json({
    order_id: id,
    total_pages: doc?.total ?? 0,
    pages: doc?.pages ?? [],
    instruments: doc?.instruments ?? [],
  });
});

const timelineHandler = http.get("/api/orders/:id/timeline", ({ params }) => {
  const id = String(params["id"]);
  return HttpResponse.json({
    order_id: id,
    events: demoTimelines[id] ?? [],
  });
});

/** Field store: deep-copied once per page session, then mutated by handlers. */
const fieldStore: Field[] = demoFields.map((f) => ({
  ...f,
  rule_refs: [...f.rule_refs],
  readings: f.readings?.map((r) => ({ ...r })),
}));

/**
 * THE ONE ORDER THIS FIXTURE DESCRIBES. `data.ts` states it plainly — "the live
 * review order — the package `demoFields` and `demoPages` describe" — and every
 * row in `fieldStore` carries it as `order_id`. Read from the data rather than
 * repeated as a literal, so the two cannot part company.
 */
const FIELDS_ORDER_ID = demoFields[0]?.order_id ?? "";

/*
 * FIXTURE CONFLICT, UNRESOLVED — FOR THE OWNER, NOT FOR THIS FILE TO GUESS.
 *
 * `pipelineFor` states the pipeline's own rule in words: the `extract` stage is
 * "Held — an incomplete package never reaches extraction", and it is `waiting`
 * for any order that has not passed the gate (`GATE_PASSED_STAGES` in
 * workspace.ts is machine/review/escalated/delivered).
 *
 * ord_demo_1 — the order this whole field fixture describes, and the one Review
 * opens on — sits at `stage: "gate"` with the stamp "Package incomplete". By the
 * rule above it has NOT reached extraction, yet this endpoint serves 21
 * extracted values with page-line provenance for it. Two server answers about
 * one order contradict each other, which is precisely the class of bug
 * `apps/web-v2/src/app/mockOrderFixtures.test.ts` was written to catch.
 *
 * There are two ways out and they are not equivalent:
 *   (a) ord_demo_1's stage is wrong — it is the order under review, so `review`,
 *       and the "Package incomplete" hero belongs to a different queue row; or
 *   (b) extraction can precede the gate, and `pipelineFor`'s wording is wrong.
 *
 * (a) looks right and would ripple through the queue bands, the gate banner and
 * the completeness screen, so it is a fixture decision rather than a fix. NOT
 * TAKEN HERE: choosing between them is a pipeline ruling, and inventing one to
 * make a screen consistent is the exact move hard rule 1 forbids.
 */

const escalationStore: Escalation[] = demoEscalations.map((e) => ({
  ...e,
  order_ids: [...e.order_ids],
}));
const ruleStore: Rule[] = demoRules.map((r) => ({ ...r }));
let draftCount = 0;
const deliveryStore = demoDeliveries.map((d) => ({
  ...d,
  report: d.report ? { ...d.report } : null,
}));
const complaintStore = demoComplaints.map((c) => ({ ...c }));
let complaintCount = 0;
const goldenStore = demoGolden.map((g) => ({ ...g }));

/** Engine roster — capabilities declared, never faked. */
const engineList: Engine[] = [
  { id: "gemini-2.5-flash", kind: "vlm_image", enabled: true, adapter_version: "1.3.0" },
  { id: "claude-api", kind: "vlm_image", enabled: true, adapter_version: "1.1.2" },
  { id: "llmwhisperer-hq", kind: "ocr_text", enabled: true, adapter_version: "1.2.1" },
  { id: "paddleocr-vl", kind: "ocr_text", enabled: true, adapter_version: "0.9.4" },
  { id: "tesseract", kind: "ocr_text", enabled: true, adapter_version: "2.0.0" },
  { id: "pdftotext", kind: "ocr_text", enabled: true, adapter_version: "1.0.0" },
];

/** Leaderboard cells. `no_truth_yet` renders literally — a cell without truth cannot be won. */
const lbCell = (
  engine_id: string,
  jurisdiction: string,
  section: string,
  acc: Record<string, number> | null,
  cost: number | null,
  p95: number | null,
  coverage: number | null,
  noTruth = false,
) => ({
  engine_id,
  section,
  jurisdiction,
  no_truth_yet: noTruth,
  accuracy_by_tag: acc,
  cost_per_1k_pages_usd: cost,
  p95_latency_ms: p95,
  golden_coverage: coverage,
});

const leaderboardCells = [
  // clayton-ga
  lbCell("gemini-2.5-flash", "clayton-ga", "mortgages", { delivered_report: 0.959, ruled: 1, suspect: 0.5 }, 8.2, 3800, 73),
  lbCell("gemini-2.5-flash", "clayton-ga", "vesting_deed", { delivered_report: 1, ruled: 1 }, 8.2, 3800, 19),
  lbCell("gemini-2.5-flash", "clayton-ga", "judgments_liens", { delivered_report: 1, ruled: 0.67, suspect: 0.25 }, 8.2, 3800, 9),
  lbCell("claude-api", "clayton-ga", "mortgages", { delivered_report: 0.986, ruled: 1, suspect: 0.5 }, 41, 6200, 73),
  lbCell("claude-api", "clayton-ga", "vesting_deed", { delivered_report: 1, ruled: 1 }, 41, 6200, 19),
  lbCell("claude-api", "clayton-ga", "judgments_liens", { delivered_report: 1, ruled: 1, suspect: 0.5 }, 41, 6200, 9),
  lbCell("llmwhisperer-hq", "clayton-ga", "mortgages", { delivered_report: 0.918, ruled: 1, suspect: 0.5 }, 12.6, 9400, 73),
  lbCell("llmwhisperer-hq", "clayton-ga", "vesting_deed", { delivered_report: 1, ruled: 1 }, 12.6, 9400, 19),
  lbCell("llmwhisperer-hq", "clayton-ga", "judgments_liens", { delivered_report: 0.5, ruled: 0.67, suspect: 0.25 }, 12.6, 9400, 9),
  lbCell("paddleocr-vl", "clayton-ga", "mortgages", { delivered_report: 0.959, ruled: 1, suspect: 0 }, 4.1, 5100, 73),
  lbCell("paddleocr-vl", "clayton-ga", "vesting_deed", { delivered_report: 1, ruled: 1 }, 4.1, 5100, 19),
  lbCell("paddleocr-vl", "clayton-ga", "judgments_liens", { delivered_report: 0.5, ruled: 0.33, suspect: 0.25 }, 4.1, 5100, 9),
  lbCell("tesseract", "clayton-ga", "mortgages", { delivered_report: 0.74, ruled: 0.8 }, 0, 1200, 73),
  lbCell("tesseract", "clayton-ga", "vesting_deed", { delivered_report: 0.895 }, 0, 1200, 19),
  lbCell("tesseract", "clayton-ga", "judgments_liens", { delivered_report: 0.33 }, 0, 1200, 9),
  // pdftotext declares no capability on scan-heavy sections — null, not faked
  lbCell("pdftotext", "clayton-ga", "mortgages", null, 0, 100, 73),
  lbCell("pdftotext", "clayton-ga", "vesting_deed", null, 0, 100, 19),
  lbCell("pdftotext", "clayton-ga", "judgments_liens", null, 0, 100, 9),
  // hartford-ct — thin coverage; vesting_deed has NO TRUTH YET
  lbCell("gemini-2.5-flash", "hartford-ct", "mortgages", { delivered_report: 0.909, ruled: 1 }, 8.2, 3800, 11),
  lbCell("gemini-2.5-flash", "hartford-ct", "vesting_deed", null, null, null, 0, true),
  lbCell("gemini-2.5-flash", "hartford-ct", "judgments_liens", { delivered_report: 0.667, ruled: 0.5 }, 8.2, 3800, 6),
  lbCell("claude-api", "hartford-ct", "mortgages", { delivered_report: 1, ruled: 1 }, 41, 6200, 11),
  lbCell("claude-api", "hartford-ct", "vesting_deed", null, null, null, 0, true),
  lbCell("claude-api", "hartford-ct", "judgments_liens", { delivered_report: 0.833, ruled: 1 }, 41, 6200, 6),
  lbCell("llmwhisperer-hq", "hartford-ct", "mortgages", { delivered_report: 0.818, ruled: 1 }, 12.6, 9400, 11),
  lbCell("llmwhisperer-hq", "hartford-ct", "vesting_deed", null, null, null, 0, true),
  lbCell("llmwhisperer-hq", "hartford-ct", "judgments_liens", { delivered_report: 0.833, ruled: 1 }, 12.6, 9400, 6),
  lbCell("paddleocr-vl", "hartford-ct", "mortgages", { delivered_report: 0.727, ruled: 0.5 }, 4.1, 5100, 11),
  lbCell("paddleocr-vl", "hartford-ct", "vesting_deed", null, null, null, 0, true),
  lbCell("paddleocr-vl", "hartford-ct", "judgments_liens", { delivered_report: 0.667, ruled: 0.5 }, 4.1, 5100, 6),
];

/** Current seat assignments — every one carries who/when/evidence. */
const routingStore = [
  ...["mortgages", "vesting_deed", "judgments_liens"].flatMap((section) =>
    ["clayton-ga", "hartford-ct"].flatMap((jurisdiction) => [
      {
        id: `rt_A_${jurisdiction}_${section}`,
        jurisdiction,
        section,
        seat: "A",
        engine_id: "gemini-2.5-flash",
        approved_by: "m.okafor",
        approved_at: "2026-07-09T16:03:00Z",
        evidence_url: "bench://run-41",
      },
      {
        id: `rt_B_${jurisdiction}_${section}`,
        jurisdiction,
        section,
        seat: "B",
        engine_id: "llmwhisperer-hq",
        approved_by: "m.okafor",
        approved_at: "2026-07-12T09:41:00Z",
        evidence_url: "bench://run-44",
      },
    ]),
  ),
];

/** Blind-fifty divergences awaiting a senior's ruling. Symmetric A/B — the model is not a party. */
const reconStore: Reconciliation[] = [
  {
    id: "rec_1",
    order_id: "ord_demo_1",
    path: "judgments_liens.1.type",
    value_a: "Judgment",
    value_b: "Lis Pendens",
    ruling_value: null,
    citation: null,
    reason: null,
    ruled_by: null,
    general_rule_id: null,
  },
  {
    id: "rec_2",
    order_id: "ord_demo_1",
    path: "judgments_liens.1.amount",
    value_a: "$4,412.83",
    value_b: "$4,112.83",
    ruling_value: null,
    citation: null,
    reason: null,
    ruled_by: null,
    general_rule_id: null,
  },
  {
    id: "rec_3",
    order_id: "ord_demo_1",
    path: "judgments_liens.2.plaintiff",
    value_a: "MERIDIAN FUNDING LLC",
    value_b: "MERIDIAN CREDIT MGMT",
    ruling_value: null,
    citation: null,
    reason: null,
    ruled_by: null,
    general_rule_id: null,
  },
];

const ok: Ack = { ok: true };
const err = (message: string, status: number) =>
  HttpResponse.json({ error: message }, { status });

/**
 * Role gate on every mutation — the authz table (contract authz.ts) enforced
 * server-side, standing in for core-api middleware. The x-mock-role header is
 * the mock's JWT role claim; a missing header means the dev-default admin
 * session (a real server would 401 instead — the mock has no anonymous
 * callers). Runs BEFORE body validation: authorization refuses ahead of
 * schema errors, exactly as middleware will.
 */
const guard = (
  request: Request,
  action: Action,
): ReturnType<typeof err> | null => {
  const raw = request.headers.get("x-mock-role");
  const role = raw === null ? "admin" : isRole(raw) ? raw : null;
  if (role !== null && canDo(role, action)) return null;
  return err(`refused: role lacks ${action}`, 403);
};

/** sha256 stand-in for the mock: file name + byte size. */
const seenPackages = new Map<string, string>();
let createdOrders = 0;

const REQUIRED_ORDER_FIELDS = [
  "client_id",
  "external_ref",
  "jurisdiction",
  "state",
  "county",
] as const;

export const handlers = [
  ...workspaceHandlers,
  ...designHandlers,
  timelineHandler,
  pagesHandler,
  /**
   * Ingest: order create + package upload (multipart). An incomplete package
   * is refused AT THE DOOR with the missing fields named — never silently.
   * A byte-identical re-upload 409s (sha256 duplicate). Acceptance is a
   * separate, explicit call — never automatic.
   */
  http.post("/api/orders", async ({ request }) => {
    const denied = guard(request, "order.create");
    if (denied) return denied;
    // An empty multipart body fails to parse in some engines — same refusal.
    const form = await request.formData().catch(() => new FormData());
    const missing: string[] = [];
    for (const key of REQUIRED_ORDER_FIELDS) {
      const v = form.get(key);
      if (typeof v !== "string" || v.trim() === "") missing.push(key);
    }
    const pkg = form.get("package");
    if (!(pkg instanceof File)) missing.push("package");
    if (missing.length > 0) {
      return HttpResponse.json(
        {
          rejected: true,
          missing_fields: missing,
          reason:
            "a report cannot be produced from this file — the order carries what the PDF cannot say",
        },
        { status: 400 },
      );
    }
    const file = pkg as File;
    const sha = `${file.name}:${file.size}`;
    const dup = seenPackages.get(sha);
    if (dup !== undefined) {
      return err(
        `duplicate package (sha256 match) — byte-identical to ${dup}`,
        409,
      );
    }
    createdOrders += 1;
    const order = {
      id: `ord_new_${createdOrders}`,
      client_id: String(form.get("client_id")),
      external_ref: String(form.get("external_ref")),
      jurisdiction: String(form.get("jurisdiction")),
      state: String(form.get("state")),
      county: String(form.get("county")),
      // A freshly ingested package has none of these resolved yet, and `null`
      // is that statement — `0` pages would assert somebody counted. Required
      // on `Order` since 2026-07-30; see the ratification note in the contract.
      product: null,
      period_label: null,
      pages: null,
      status: "ingested",
      arrived_at: new Date().toISOString(),
      accepted_at: null,
      delivered_at: null,
    };
    seenPackages.set(sha, order.external_ref);
    return HttpResponse.json({ order }, { status: 201 });
  }),

  /** Explicit accept — a named person signs for the package. Never auto. */
  http.post("/api/orders/:id/accept", ({ request }) => {
    return guard(request, "order.accept") ?? HttpResponse.json(ok);
  }),

  http.get("/api/queue/next", () => {
    const body: QueueNextResponse = {
      order: queue[queueHead % queue.length] ?? null,
    };
    return HttpResponse.json(body);
  }),

  /**
   * READ ONLY. No band row carries a way to take the work — see `bandRow`.
   * The x-mock-role header is the mock's JWT role claim, the same convention
   * `guard` reads below; a missing header is the dev-default admin session.
   */
  http.get("/api/queue/bands", ({ request }) => {
    const raw = request.headers.get("x-mock-role");
    return HttpResponse.json(queueBandsFor(raw === null ? "admin" : raw));
  }),

  /**
   * The order-scoped read the top strip needs. An id that names no order is a
   * 404 — never an invented context. See `orderContextFor`.
   */
  http.get("/api/orders/:id/context", ({ params }) => {
    const row = demoOrderRow(String(params["id"]));
    if (row === undefined) return err("no such order", 404);
    return HttpResponse.json(orderContextFor(row.id));
  }),

  http.post("/api/orders/:id/pass", async ({ request }) => {
    const denied = guard(request, "order.pass");
    if (denied) return denied;
    const parsed = PassOrderRequest.safeParse(await request.json());
    if (!parsed.success) {
      // No reason, no pass — the refusal is the product requirement.
      return err(parsed.error.message, 422);
    }
    queueHead += 1;
    const body: PassOrderResponse = { ok: true };
    return HttpResponse.json(body);
  }),

  /*
   * THIS USED TO ANSWER FOR ANY ORDER WITH ONE ORDER'S FIELDS. It echoed the
   * requested id into `order_id` and then returned `fieldStore` — ord_demo_1's
   * 21 values, its 2 auto-confirmed and its 6 needing review — whoever asked.
   * The rail made it visible: `/questions` resolves to ord_demo_4, an order at
   * INTAKE, and its Review stage drew a badge of "6" counting another order's
   * unanswered decisions.
   *
   * An order with no field fixture now gets an EMPTY set and a zero census, and
   * the distinction between those two answers is the point. Empty says "this
   * server holds no extracted values for that order" — which is true, and which
   * the rail renders as no badge at all, the same thing it draws off an order
   * screen. The old behaviour said something false about a real order.
   *
   * WHAT IS *NOT* DECIDED HERE, deliberately: which orders SHOULD have fields.
   * That is a pipeline rule, and this file does not get to invent one from what
   * a screen wants to show (hard rule 1). It is also not currently self-
   * consistent — see the FIXTURE CONFLICT note below.
   */
  http.get("/api/orders/:id/fields", ({ params }) => {
    const id = String(params["id"]);
    const fields = id === FIELDS_ORDER_ID ? fieldStore : [];
    /*
     * THE DECISION FIGURES, DECIDED HERE.
     *
     * `decisions` is every field this order ever put in front of a person —
     * the ones a reviewer settled plus the ones still queued. It is NOT
     * `fields.length`: the 2 auto-confirmed nobody saw and the 1 pending
     * nothing has read yet were never anybody's decision, and counting them
     * would silently inflate the denominator the dock prints.
     *
     * `queue_rest` is everything this order still holds BEHIND the open
     * decision — the whole of what the reviewer has left to walk, not just the
     * unsettled part of it, because a reviewer moving back through a settled
     * ruling is still walking this order's queue. Written as its own figure
     * rather than left to the client as `decisions - 1`, because that
     * subtraction is precisely the `answered = base + a` arithmetic the
     * contract comment above this endpoint exists to forbid.
     */
    const queued = fields.filter((f) => f.state === "needs_review");
    const settled = fields.filter(
      (f) => f.state === "confirmed" || f.state === "corrected" || f.state === "escalated",
    );
    const body: OrderFieldsResponse = {
      order_id: id,
      fields,
      // The census is the SERVER'S, and this is where it is decided. It used to
      // be computed in `OrderCounts.tsx` — including `no_source`, which is a
      // ruling on provenance the browser has no standing to make (hard rule 3).
      // It is written out here rather than tallied so that this file states the
      // definition the real backend will have to match.
      census: {
        fields: fields.length,
        auto_confirmed: fields.filter((f) => f.state === "auto_confirmed").length,
        needs_review: fields.filter((f) => f.state === "needs_review").length,
        no_source: fields.filter(
          (f) =>
            f.value !== null &&
            f.source_doc_id === null &&
            f.source_page === null &&
            (f.readings ?? []).length === 0,
        ).length,
        decisions: settled.length + queued.length,
        settled: settled.length,
        queue_rest: Math.max(settled.length + queued.length - 1, 0),
        /*
         * WHAT THE SERVER IS STILL WAITING ON — the queued fields, counted
         * here rather than left to the client as `decisions - settled`.
         *
         * The two happen to agree in this fixture and they are not the same
         * question: `queue_rest` is how much queue is left to WALK, and this
         * is how many still want an answer. Written off `queued` directly so
         * the definition sits with the filter that makes it.
         */
        remaining: queued.length,
      },
    };
    return HttpResponse.json(body);
  }),

  /**
   * Idempotent confirm — bug-5 semantics (CONTEXT §19): same value on a
   * confirmed field = 200; different value = 409; terminal state = 409.
   */
  http.post("/api/fields/:id/confirm", async ({ params, request }) => {
    const denied = guard(request, "field.confirm");
    if (denied) return denied;
    const parsed = ConfirmFieldRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const field = fieldStore.find((f) => f.id === params["id"]);
    if (!field) return err("no such field", 404);
    if (field.state === "corrected" || field.state === "escalated") {
      return err(`field is terminal (${field.state})`, 409);
    }
    if (
      (field.state === "confirmed" || field.state === "auto_confirmed") &&
      field.approved_by !== null
    ) {
      if (parsed.data.value === field.value) return HttpResponse.json(ok);
      return err("already confirmed with a different value", 409);
    }
    field.state = "confirmed";
    field.approved_by = "L. Vance";
    field.approved_at = new Date().toISOString();
    return HttpResponse.json(ok);
  }),

  http.post("/api/fields/:id/correct", async ({ params, request }) => {
    const denied = guard(request, "field.correct");
    if (denied) return denied;
    const parsed = CorrectFieldRequest.safeParse(await request.json());
    if (!parsed.success) {
      // The refusal is the product requirement: no reason, no correction.
      return err(parsed.error.message, 422);
    }
    const field = fieldStore.find((f) => f.id === params["id"]);
    if (!field) return err("no such field", 404);
    field.state = "corrected";
    field.value = parsed.data.value;
    // Validate against the contract enum rather than an inline list. The list
    // was the old two members, so widening NaReason to four (ratified Q1)
    // silently dropped NOT_FOUND and NOT_STATED to null here — a reviewer's
    // correction to "document silent" would have been recorded as no NA reason
    // at all. Reading the enum means the next widening cannot repeat it.
    const na = NaReason.safeParse(parsed.data.na_reason);
    field.na_reason = na.success ? na.data : null;
    field.approved_by = "L. Vance";
    field.approved_at = new Date().toISOString();
    return HttpResponse.json(ok);
  }),

  /**
   * Suppress with reason — R13. Terminal, like correct and escalate.
   *
   * R13 IS ENFORCED HERE, NOT ONLY WHERE THE BUTTON IS DRAWN. Suppression is
   * offered where party identity IS the question — `judgments.*` — and the UI
   * gated only the control: the `x` chord posted an exclude on `owner.zip` and
   * this handler returned 200. A rule the client alone enforces is not
   * enforced, and an excluded row is GONE (`conflicts.md` C18), so the one
   * write that cannot be argued with afterwards was the one with no server
   * check at all. The message is written to be read by a person, because it
   * renders verbatim in the review screen's server note.
   */
  http.post("/api/fields/:id/exclude", async ({ params, request }) => {
    const denied = guard(request, "field.correct");
    if (denied) return denied;
    const parsed = ExcludeFieldRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const field = fieldStore.find((f) => f.id === params["id"]);
    if (!field) return err("no such field", 404);
    if (!field.path.startsWith("judgments.")) {
      return err(
        `exclude applies only to judgment party rows (R13); ${field.path} is not one`,
        422,
      );
    }
    if (field.state === "corrected" || field.state === "escalated") {
      return err(`field is terminal (${field.state})`, 409);
    }
    field.excluded_reason = parsed.data.reason;
    field.approved_by = "L. Vance";
    field.approved_at = new Date().toISOString();
    return HttpResponse.json(ok);
  }),

  http.post("/api/fields/:id/escalate", async ({ params, request }) => {
    const denied = guard(request, "field.escalate");
    if (denied) return denied;
    const parsed = EscalateFieldRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const field = fieldStore.find((f) => f.id === params["id"]);
    if (!field) return err("no such field", 404);
    field.state = "escalated";
    return HttpResponse.json(ok);
  }),

  /** Broken-input channel — routes to developers, never the rules inbox. */
  http.post("/api/bugs", async ({ request }) => {
    const denied = guard(request, "bug.file");
    if (denied) return denied;
    const parsed = CreateBugRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    return HttpResponse.json(ok, { status: 201 });
  }),

  /**
   * Metrics — computed nightly server-side. catch_rate is the headline;
   * probes appear as AGGREGATE counts only (no probe detail exists in any
   * client-consumable shape). No aggregate accuracy, no per-reviewer data.
   */
  http.get("/api/metrics", () =>
    HttpResponse.json({
      catch_rate: 0.71,
      probes_planted: 34,
      probes_caught: 24,
      catch_rate_history: [
        0.88, 0.91, 0.86, 0.89, 0.9, 0.87, 0.89, 0.92, 0.88, 0.84, 0.78, 0.71,
      ],
      catch_rate_floor: 0.85,
      correction_rate: 0.074,
      fields_reviewed: 4806,
      corrected: 356,
      median_minutes_per_order: 9.6,
      auto_confirm_rate: 0.74,
      auto_sample_correction_rate: 0.009,
      auto_sample_n: 1120,
      escalations_per_100: 3.1,
      escalations_per_100_history: [
        12.4, 10.8, 9.9, 8.6, 7.2, 6.1, 5.2, 4.4, 3.9, 3.4, 3.2, 3.1, 3.2, 3.1,
      ],
      escalations_this_week: 41,
      correction_by_source: [
        {
          source: "text_layer",
          correction_rate: 0.018,
          n: 780,
          alarm: true,
          note: "ALARMING — machine-readable and still wrong. These are bugs, not hard documents.",
        },
        {
          source: "ocr",
          correction_rate: 0.112,
          n: 277,
          alarm: false,
          note: "expected — the rate says whether DPI, crop, or model needs work",
        },
        {
          source: "vision",
          correction_rate: 0.165,
          n: 73,
          alarm: false,
          note: "handwriting and stamps — small volume, hardest class",
        },
        {
          source: "derived",
          correction_rate: 0.004,
          n: 460,
          alarm: true,
          note: "SHOULD BE IMPOSSIBLE — each one is an upstream bug being hidden",
        },
      ],
      field_backlog: [
        { path: "judgments.1.plaintiff_attorney", correction_rate: 0.61, n: 41 },
        { path: "mortgages.1.amount", correction_rate: 0.24, n: 46 },
        { path: "legal.plat_book_page", correction_rate: 0.18, n: 33 },
        { path: "owner.zip", correction_rate: 0.14, n: 44 },
        { path: "assessment.city_tax", correction_rate: 0.12, n: 25 },
        { path: "deed.consideration", correction_rate: 0.04, n: 48 },
      ],
      blind_fifty: {
        orders_total: 50,
        submitted_a: 18,
        submitted_b: 11,
        ready_for_reconciliation: 7,
        oldest_waiting_days: 3,
        reconciled: 3,
        drafts_pending: 4,
        judgment_fields_reconciled: 6,
        judgment_fields_target: 40,
        orders: [
          {
            order_ref: "BLIND-0644",
            jurisdiction: "Fayette GA",
            a_submitted: "submitted",
            b_submitted: "submitted",
            reconciliation: "waiting 3 d",
            golden_line: null,
            drafts: null,
          },
          {
            order_ref: "BLIND-0643",
            jurisdiction: "DeKalb GA",
            a_submitted: "submitted",
            b_submitted: "submitted",
            reconciliation: "in progress — 5 of 9 ruled",
            golden_line: null,
            drafts: null,
          },
          {
            order_ref: "BLIND-0640",
            jurisdiction: "Houston GA",
            a_submitted: "submitted",
            b_submitted: "submitted",
            reconciliation: "complete",
            golden_line: "106 agreed + 12 ruled",
            drafts: "2 pending",
          },
          {
            order_ref: "BLIND-0641",
            jurisdiction: "Greene GA",
            a_submitted: "submitted",
            b_submitted: "submitted",
            reconciliation: "complete",
            golden_line: "115 agreed + 6 ruled",
            drafts: "1 pending",
          },
          {
            order_ref: "BLIND-0651",
            jurisdiction: "Mecklenburg NC",
            a_submitted: "submitted",
            b_submitted: "in_progress",
            reconciliation: null,
            golden_line: null,
            drafts: null,
          },
          {
            order_ref: "BLIND-0654",
            jurisdiction: "San Diego CA",
            a_submitted: "in_progress",
            b_submitted: "not_started",
            reconciliation: null,
            golden_line: null,
            drafts: null,
          },
        ],
        section_coverage: [
          { section: "mortgages", fields: 428, note: null, warn: false },
          { section: "vesting_deed", fields: 121, note: null, warn: false },
          { section: "assessment", fields: 118, note: null, warn: false },
          {
            section: "judgments_liens",
            fields: 6,
            note: "below the ≥40-field gate. R13/R18 closed the rules — coverage is now the only gate left to judgment automation. Not an error, a warning: judgments stay human-reviewed until this crosses 40.",
            warn: true,
          },
          { section: "counts", fields: 44, note: null, warn: false },
          { section: "location", fields: 28, note: null, warn: false },
        ],
      },
    }),
  ),

  /** Server-authored drill-downs. Probe details are never a signal. */
  http.get("/api/derived/:signal", ({ params }) => {
    const signal = String(params["signal"]);
    const drills: Record<
      string,
      {
        title: string;
        note: string | null;
        rows: {
          head: string;
          body: string;
          meta: string | null;
          order_id: string | null;
        }[];
      }
    > = {
      corrections: {
        title: "CORRECTIONS — LAST 4 WEEKS",
        note: "Falling corrections + falling catching = looking less.",
        rows: [
          {
            head: "judgments.1.plaintiff_attorney",
            body: "Corrected 25 times — extraction returns nothing on machine-readable pages.",
            meta: "61% of reviews · ticket EXT-1142",
            order_id: null,
          },
          {
            head: "mortgages.1.amount",
            body: "Corrected 11 times — low-DPI scans, OCR digit swaps.",
            meta: "24% of reviews",
            order_id: "ord_demo_1",
          },
          {
            head: "owner.zip",
            body: "Corrected 6 times — order sheet disagrees with recorded documents.",
            meta: "14% of reviews",
            order_id: "ord_demo_1",
          },
        ],
      },
      speed: {
        title: "TIME PER ORDER — DISTRIBUTION",
        note: "Faster is only good if catching holds.",
        rows: [
          {
            head: "median 9.6 min (was 11.2)",
            body: "The 40–60 min hand-typing baseline is long gone; the question now is only quality.",
            meta: "last 4 weeks · 412 orders",
            order_id: null,
          },
        ],
      },
      auto: {
        title: "AUTO-CONFIRMED FIELDS — SAMPLED",
        note: "Fields the pipeline confirmed without human review, re-checked on a 5% sample.",
        rows: [
          {
            head: "sample n = 1,120 fields",
            body: "10 corrections found (0.9%). High auto + high correction together would mean the threshold is set wrong.",
            meta: "last 4 weeks",
            order_id: null,
          },
        ],
      },
      escalations: {
        title: "ESCALATIONS — THIS WEEK'S 41, BY CLUSTER",
        note: "What remains clusters around genuine judgment.",
        rows: [
          {
            head: "judgments.hit_identity — 3 open",
            body: "“is this the same defendant”, “which of these hits is ours” — rule not yet written.",
            meta: "2 orders · 9 days",
            order_id: null,
          },
          {
            head: "liens.hoa_age — 1 open",
            body: "“same HOA as the one above, why is this one out?”",
            meta: "1 order · today",
            order_id: null,
          },
        ],
      },
      "source:text_layer": {
        title: "text_layer CORRECTIONS — 14 LAST MONTH",
        note: "Machine-readable and extraction still got it wrong. These are bugs, not hard documents.",
        rows: [
          {
            head: "judgments.1.plaintiff_attorney ×9",
            body: "Attorney block present in text layer; parser returns null. Ticket EXT-1142, open 11 days.",
            meta: "9 of 14",
            order_id: null,
          },
        ],
      },
      "source:ocr": {
        title: "ocr CORRECTIONS — EXPECTED, BUT PATTERNED",
        note: "The rate tells you whether the DPI, the crop, or the model needs work.",
        rows: [
          {
            head: "digit swaps in currency ×18",
            body: "Clusters on faxed security deeds under 200 DPI.",
            meta: "18 of 31",
            order_id: null,
          },
        ],
      },
      "source:vision": {
        title: "vision CORRECTIONS",
        note: "Handwritten and stamped material — the hardest class.",
        rows: [
          {
            head: "handwritten legal descriptions ×5",
            body: "Pre-1980 deeds. Likely permanent human territory.",
            meta: "5 of 12",
            order_id: null,
          },
        ],
      },
      "source:derived": {
        title: "derived CORRECTIONS — SHOULD BE IMPOSSIBLE",
        note: "A derived field is computed. Each correction here is an upstream bug the correction now hides.",
        rows: [
          {
            head: "mortgages.count corrected ×2",
            body: "Release-chain matcher missed a cancellation under a re-recorded book/page. Bug reports cluster by field_path — same field wrong twice is one broken function, not two defects.",
            meta: "ticket EXT-1187 · resolver is a developer, not a senior reviewer",
            order_id: null,
          },
        ],
      },
    };
    const backlogMatch = /^field:(.+)$/.exec(signal);
    const body = backlogMatch
      ? {
          title: `${backlogMatch[1]} — REVIEW HISTORY`,
          note: "A field corrected this often is not a reviewer problem; it is a ticket.",
          rows: [
            {
              head: "corrected ×25 · confirmed N/A ×9 · escalated ×7",
              body: "Extraction returns null whenever the block follows a page break.",
              meta: "ticket EXT-1142 · fix removes ~25 corrections/month",
              order_id: null,
            },
          ],
        }
      : drills[signal];
    if (!body) return err("no such signal", 404);
    return HttpResponse.json({ signal, ...body });
  }),

  http.get("/api/deliveries", () =>
    HttpResponse.json({ deliveries: deliveryStore }),
  ),

  /** Retry re-SENDS the same file — the report is never re-rendered. */
  http.post("/api/deliveries/:id/retry", ({ params, request }) => {
    const denied = guard(request, "delivery.retry");
    if (denied) return denied;
    const d = deliveryStore.find((x) => x.id === params["id"]);
    if (!d) return err("no such delivery", 404);
    d.status = "delivered";
    d.delivered_at = new Date().toISOString();
    d.evidence = "delivered on retry — same file, same report version";
    return HttpResponse.json(ok);
  }),

  http.get("/api/complaints", () =>
    HttpResponse.json({ complaints: complaintStore }),
  ),

  /** Per-field complaint capture. Two states only: recorded, resolved. */
  http.post("/api/complaints", async ({ request }) => {
    const denied = guard(request, "complaint.record");
    if (denied) return denied;
    const parsed = CreateComplaintRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    complaintCount += 1;
    const shipped =
      fieldStore.find((f) => f.path === parsed.data.field_path)?.value ?? null;
    complaintStore.unshift({
      id: `cmp_new_${complaintCount}`,
      order_id: parsed.data.order_id,
      field_path: parsed.data.field_path,
      shipped_value: shipped,
      client_value: parsed.data.client_value ?? null,
      how_it_got_through: "human_confirmed",
      resolution: null,
      rule_id: null,
      golden_offer_accepted: null,
    });
    return HttpResponse.json(ok, { status: 201 });
  }),

  /**
   * Complaint resolution — REFUSED without a rule (the complaint loop
   * terminates in a rulebook entry, principle 3). A drafted rule lands
   * PENDING (origin: complaint) and cannot affect the pipeline until an
   * engineer confirms it. The golden-case offer is optional. Two states
   * only: recorded → resolved; a resolved complaint 409s a second attempt.
   */
  http.post("/api/complaints/:id/resolve", async ({ params, request }) => {
    const denied = guard(request, "complaint.resolve");
    if (denied) return denied;
    const parsed = ResolveComplaintRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const c = complaintStore.find((x) => x.id === params["id"]);
    if (!c) return err("no such complaint", 404);
    if (c.resolution !== null) return err("already resolved", 409);
    let ruleId: string;
    if ("rule_id" in parsed.data.rule) {
      ruleId = parsed.data.rule.rule_id;
      if (!ruleStore.some((r) => r.id === ruleId)) {
        return err("cited rule does not exist", 422);
      }
    } else {
      const draft = parsed.data.rule.draft;
      draftCount += 1;
      const rule: Rule = {
        id: `rule_draft_${draftCount}`,
        code: `DRAFT-CMP-${draftCount}`,
        text: draft.text,
        origin: "complaint",
        status: "pending",
        jurisdiction_scope: draft.jurisdiction_scope ?? null,
        version: 1,
        confirmed_by: null,
        source_doc_ref: null,
      };
      ruleStore.push(rule);
      ruleId = rule.id;
    }
    c.resolution = parsed.data.resolution;
    c.rule_id = ruleId;
    c.golden_offer_accepted = parsed.data.golden_offer_accepted ?? null;
    return HttpResponse.json(ok);
  }),

  /** Section × tag matrix vs the golden set. No aggregate number exists here. */
  http.get("/api/bench/results", () =>
    HttpResponse.json({
      run_ref: "run #47",
      seed_version: "seed v3",
      total_fields: 131,
      orders: 6,
      cells: [
        { section: "mortgages", tag: "delivered_report", fields: 66, passed: 64 },
        { section: "mortgages", tag: "ruled", fields: 5, passed: 5 },
        { section: "mortgages", tag: "suspect", fields: 2, passed: 1 },
        { section: "vesting_deed", tag: "delivered_report", fields: 15, passed: 15 },
        { section: "vesting_deed", tag: "ruled", fields: 4, passed: 4 },
        { section: "assessment", tag: "delivered_report", fields: 17, passed: 16 },
        { section: "assessment", tag: "ruled", fields: 2, passed: 2 },
        { section: "judgments_liens", tag: "delivered_report", fields: 2, passed: 2 },
        { section: "judgments_liens", tag: "ruled", fields: 3, passed: 2 },
        { section: "judgments_liens", tag: "suspect", fields: 4, passed: 1 },
        { section: "counts", tag: "ruled", fields: 7, passed: 6 },
        { section: "location", tag: "delivered_report", fields: 4, passed: 4 },
      ],
      sections: [
        {
          section: "mortgages",
          n: 73,
          passed: 71,
          suspect_note: null,
          note: null,
          fails: [
            {
              path: "mortgages.1.amount",
              tag: "delivered_report",
              model_value: "$220,224.00 (p 3, conf 0.88)",
              seed_value: "$202,224.00",
              source_note:
                "Security deed, degraded 1987 fax p 3 — artefact over the amount; words line legible. §5: words prevail.",
              golden_field_id: "gf_1",
            },
            {
              path: "mortgages.1.min",
              tag: "suspect",
              model_value: "1000-2000039171-4",
              seed_value: "not stated",
              source_note:
                "seed sourced from a defect-prone report section; the model may be right",
              golden_field_id: null,
            },
          ],
        },
        {
          section: "vesting_deed",
          n: 19,
          passed: 19,
          suspect_note: null,
          note: null,
          fails: [],
        },
        {
          section: "assessment",
          n: 19,
          passed: 18,
          suspect_note: null,
          note: null,
          fails: [
            {
              path: "assessment.land_value",
              tag: "delivered_report",
              model_value: "$28,000 (tax bill, p 22)",
              seed_value: "$30,100",
              source_note:
                "Property card — assessment priority runs per field: card over tax bill, most recent appraisal year",
              golden_field_id: null,
            },
          ],
        },
        {
          section: "judgments_liens",
          n: 9,
          passed: 5,
          suspect_note:
            "SUSPECT — thin seed (9f), 3 of 7 known defects, lowest typist accuracy. Do not optimise against this without the blind fifty.",
          note: null,
          fails: [
            {
              path: "judgments_liens.1.type",
              tag: "ruled",
              model_value: "Judgment",
              seed_value: "Lis Pendens",
              source_note:
                "RULED: a lis pendens is a pending-suit notice, not a judgment. Always actionable.",
              golden_field_id: "gf_2",
            },
            {
              path: "judgments_liens.1.attorney",
              tag: "suspect",
              model_value: "Q. T. FENWICK & ASSOC., P.C.",
              seed_value: "Not Available",
              source_note:
                "typed report, judgments section — the model may be right and the seed wrong",
              golden_field_id: "gf_3",
            },
            {
              path: "judgments_liens.1.amount",
              tag: "suspect",
              model_value: "$4,112.83",
              seed_value: "$4,412.83",
              source_note:
                "typist accuracy lowest here; do not optimise against this cell",
              golden_field_id: null,
            },
            {
              path: "judgments_liens.2.included",
              tag: "suspect",
              model_value: "omitted (dismissed)",
              seed_value: "included",
              source_note: "suspect seed source",
              golden_field_id: null,
            },
          ],
        },
        {
          section: "counts",
          n: 7,
          passed: 6,
          suspect_note: null,
          note: null,
          fails: [
            {
              path: "counts.n_judgments",
              tag: "ruled",
              model_value: "04",
              seed_value: "01",
              source_note:
                "Ruling: a summons is not a judgment; only recorded judgments increment the count. Always actionable.",
              golden_field_id: null,
            },
          ],
        },
        {
          section: "location",
          n: 4,
          passed: 4,
          suspect_note: null,
          note: "4 of 5 seeded — location.zip is ORDER_SUPPLIED, absent from every denominator",
          fails: [],
        },
      ],
    }),
  ),

  http.get("/api/engines", () => HttpResponse.json({ engines: engineList })),

  /** Engine × section × jurisdiction vs the golden set. NO aggregate exists. */
  http.get("/api/engines/leaderboard", () =>
    HttpResponse.json({ cells: leaderboardCells }),
  ),

  http.get("/api/engines/routing", () =>
    HttpResponse.json({ cells: routingStore }),
  ),

  /**
   * Seat change — human-approved, config flip only, logged with who/when and
   * REQUIRED evidence. No auto-promotion exists anywhere.
   */
  http.post("/api/engines/routing", async ({ request }) => {
    const denied = guard(request, "routing.flip");
    if (denied) return denied;
    const parsed = EngineRoutingRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const cell = routingStore.find(
      (c) =>
        c.jurisdiction === parsed.data.jurisdiction &&
        c.section === parsed.data.section &&
        c.seat === parsed.data.seat,
    );
    if (!cell) return err("no such routing cell", 404);
    cell.engine_id = parsed.data.engine_id;
    cell.approved_by = "m.okafor";
    cell.approved_at = new Date().toISOString();
    cell.evidence_url = parsed.data.evidence_url;
    return HttpResponse.json(ok);
  }),

  http.get("/api/reconciliation/:order", ({ params }) =>
    // Filtered by order — an unknown id gets an EMPTY list, never someone
    // else's divergences dressed up as this order's.
    HttpResponse.json({
      order_id: String(params["order"]),
      divergences: reconStore.filter(
        (d) => d.order_id === String(params["order"]),
      ),
    }),
  ),

  /**
   * A ruling with no source is an opinion — citation is REQUIRED
   * (contract-enforced). A general rule may accompany the ruling as a draft;
   * it lands PENDING, never live. Rulings are per-path.
   */
  http.post("/api/reconciliation/:order", async ({ request }) => {
    const denied = guard(request, "reconciliation.rule");
    if (denied) return denied;
    const parsed = ReconciliationRulingRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const div = reconStore.find((d) => d.path === parsed.data.path);
    if (!div) return err("no such divergence", 404);
    if (div.ruling_value !== null || div.ruled_by !== null) {
      return err("already ruled", 409);
    }
    div.ruling_value = parsed.data.ruling_value;
    div.citation = parsed.data.citation;
    div.reason = parsed.data.reason ?? null;
    div.ruled_by = "L. Vance";
    if (parsed.data.general_rule_draft) {
      draftCount += 1;
      const rule: Rule = {
        id: `rule_draft_${draftCount}`,
        code: `DRAFT-REC-${draftCount}`,
        text: parsed.data.general_rule_draft.text,
        origin: "reconciliation",
        status: "pending",
        jurisdiction_scope:
          parsed.data.general_rule_draft.jurisdiction_scope ?? null,
        version: 1,
        confirmed_by: null,
        source_doc_ref: null,
      };
      ruleStore.push(rule);
      div.general_rule_id = rule.id;
    }
    return HttpResponse.json(ok);
  }),

  http.get("/api/golden", () =>
    HttpResponse.json({ golden_fields: goldenStore }),
  ),

  /**
   * Golden correction — permanently logged, on the record. Refused without
   * source_citation + reason (contract-enforced). Tag upgrades to `ruled`; the
   * prior value survives in corrected_from forever. The signer is derived from
   * the authenticated identity (x-mock-actor stands in for the session/JWT
   * identity claim), NEVER a client-supplied body field — a browser must not
   * decide who signed a change to ground truth.
   */
  http.post("/api/golden/corrections", async ({ request }) => {
    const denied = guard(request, "golden.correct");
    if (denied) return denied;
    const parsed = GoldenCorrectionRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const gf = goldenStore.find((g) => g.id === parsed.data.golden_field_id);
    if (!gf) return err("no such golden field", 404);
    gf.corrected_from = gf.value;
    gf.value = parsed.data.corrected_value;
    gf.tag = "ruled";
    gf.source_citation = parsed.data.source_citation;
    gf.corrected_by = request.headers.get("x-mock-actor") ?? "unknown";
    gf.corrected_at = new Date().toISOString();
    gf.correction_reason = parsed.data.reason;
    return HttpResponse.json(ok, { status: 201 });
  }),

  /**
   * Confirm seed — the seed is right; the model failure is real. VALUE
   * unchanged (corrected_from stays null — nothing changed); tag upgrades
   * delivered_report → `ruled` (now human-verified). Signed + reasoned,
   * permanent. One action per field: a field already acted on 409s.
   */
  http.post("/api/golden/:id/confirm", async ({ params, request }) => {
    const denied = guard(request, "golden.confirm");
    if (denied) return denied;
    const parsed = GoldenAffirmRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const gf = goldenStore.find((g) => g.id === params["id"]);
    if (!gf) return err("no such golden field", 404);
    if (gf.corrected_at !== null) return err("seed already resolved", 409);
    gf.tag = "ruled";
    gf.corrected_by = request.headers.get("x-mock-actor") ?? "unknown";
    gf.corrected_at = new Date().toISOString();
    gf.correction_reason = parsed.data.reason;
    return HttpResponse.json(ok, { status: 201 });
  }),

  /**
   * Demote seed to suspect — the document is ambiguous; neither value can be
   * confirmed (a diagnosis, PRD §12). VALUE unchanged; tag → `suspect`.
   * Signed (server-derived actor) + reasoned, permanent. One action per field.
   */
  http.post("/api/golden/:id/demote", async ({ params, request }) => {
    const denied = guard(request, "golden.demote");
    if (denied) return denied;
    const parsed = GoldenAffirmRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const gf = goldenStore.find((g) => g.id === params["id"]);
    if (!gf) return err("no such golden field", 404);
    if (gf.corrected_at !== null) return err("seed already resolved", 409);
    gf.tag = "suspect";
    gf.corrected_by = request.headers.get("x-mock-actor") ?? "unknown";
    gf.corrected_at = new Date().toISOString();
    gf.correction_reason = parsed.data.reason;
    return HttpResponse.json(ok, { status: 201 });
  }),

  /**
   * Blind-fifty capture. This endpoint PHYSICALLY cannot return model output
   * or the other seat's entries — the response is the minimal ack, and
   * widening it is a design defect (contract note). Blindness is enforced
   * server-side; the security test lives with the real server.
   */
  http.post("/api/blind/:order/entries", async ({ request }) => {
    const denied = guard(request, "blind.submit");
    if (denied) return denied;
    const parsed = BlindEntriesRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    return HttpResponse.json({
      accepted: true,
      entry_ids: parsed.data.entries.map((_e, i) => `be_${i + 1}`),
    });
  }),

  http.get("/api/escalations", () =>
    HttpResponse.json({ escalations: escalationStore }),
  ),

  /**
   * Rules-as-data: the caller's authz projection, holder lists redacted.
   * Contains ONLY this role's grants — a typist's payload does not mention
   * other worlds. At P1 the role comes from the Clerk claim, same shape.
   */
  http.get("/api/me/permissions", ({ request }) => {
    const raw = request.headers.get("x-mock-role");
    // missing header = the dev-default admin session; a PRESENT-but-unknown
    // role is refused — forged garbage must never yield the widest world
    if (raw !== null && !isRole(raw)) return err("unknown role", 400);
    const role = raw !== null && isRole(raw) ? raw : "admin";
    return HttpResponse.json({ role, rules: rulesFor(role) });
  }),

  http.get("/api/rules", () => HttpResponse.json({ rules: ruleStore })),

  /** The engineer gate: PENDING → live, with a named confirmer. */
  http.post("/api/rules/:id/confirm", ({ params, request }) => {
    const denied = guard(request, "rule.confirm");
    if (denied) return denied;
    const rule = ruleStore.find((r) => r.id === params["id"]);
    if (!rule) return err("no such rule", 404);
    if (rule.status !== "pending") return err("rule is not pending", 409);
    rule.status = "live";
    rule.confirmed_by = "eng_demo";
    return HttpResponse.json(ok);
  }),

  /** Append-only audit view — read-only; no write endpoint exists. */
  http.get("/api/audit", () =>
    HttpResponse.json({
      entries: [
        {
          id: "aud_5",
          actor_id: "m.okafor",
          action: "engine_seat_change",
          entity: "engine_routing",
          entity_id: "rt_B_hartford-ct_judgments_liens",
          at: "2026-07-12T09:41:00Z",
        },
        {
          id: "aud_4",
          actor_id: "M. Estrada",
          action: "golden_correction",
          entity: "golden_fields",
          entity_id: "gf_2",
          at: "2026-07-09T14:02:00Z",
        },
        {
          id: "aud_3",
          actor_id: "M. Estrada",
          action: "escalation_resolved",
          entity: "escalations",
          entity_id: "esc_tax_1",
          at: "2026-07-09T11:20:00Z",
        },
        {
          id: "aud_2",
          actor_id: "eng_demo",
          action: "rule_confirmed",
          entity: "rules",
          entity_id: "rule_tax_vintage",
          at: "2026-07-09T10:05:00Z",
        },
        {
          id: "aud_1",
          actor_id: "L. Vance",
          action: "field_confirmed",
          entity: "fields",
          entity_id: "fld_owner",
          at: "2026-07-08T15:44:00Z",
        },
      ],
    }),
  ),

  /**
   * Escalation resolution is REFUSED without a rule — the rule IS the
   * resolution. A drafted rule lands PENDING (origin: escalation) and cannot
   * affect the pipeline until an engineer confirms it.
   */
  http.post("/api/escalations/:id/resolve", async ({ params, request }) => {
    const denied = guard(request, "escalation.resolve");
    if (denied) return denied;
    const parsed = ResolveEscalationRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    const esc = escalationStore.find((e) => e.id === params["id"]);
    if (!esc) return err("no such escalation", 404);
    if (esc.resolution !== null) return err("already resolved", 409);
    let ruleId: string;
    if ("rule_id" in parsed.data.rule) {
      ruleId = parsed.data.rule.rule_id;
      if (!ruleStore.some((r) => r.id === ruleId)) {
        return err("cited rule does not exist", 422);
      }
    } else {
      const draft = parsed.data.rule.draft;
      draftCount += 1;
      const rule: Rule = {
        id: `rule_draft_${draftCount}`,
        code: `DRAFT-ESC-${draftCount}`,
        text: draft.text,
        origin: "escalation",
        status: "pending",
        jurisdiction_scope: draft.jurisdiction_scope ?? null,
        version: 1,
        confirmed_by: null,
        source_doc_ref: null,
      };
      ruleStore.push(rule);
      ruleId = rule.id;
    }
    esc.resolution = parsed.data.ruling;
    esc.rule_id = ruleId;
    // the demo session's name — "resolved by <someone else>" right after
    // YOU resolved it reads as a bug
    esc.resolved_by = "L. Vance";
    return HttpResponse.json(ok);
  }),
];
