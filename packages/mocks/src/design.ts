import { http, HttpResponse } from "msw";
import type {
  CompositionResponse,
  JurisdictionResponse,
  OrderFilter,
  OrderRow,
  OrdersPageResponse,
  QuarantineResponse,
  TemplateResponse,
  CaptureScheduleResponse,
  ArtifactsResponse,
  CountersignsResponse,
} from "@titlepipe/contract";
import { demoOrders } from "./data.js";

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

const composition = (orderId: string): CompositionResponse => ({
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
  gates: [
    { id: "g1", label: "Every flagged decision answered", passed: false, detail: "6 still open" },
    { id: "g2", label: "Every value carries a citation", passed: false, detail: "1 value has no provenance" },
    { id: "g3", label: "Chain of title unbroken through the statutory period", passed: true, detail: null },
    { id: "g4", label: "T1 second read countersigned", passed: false, detail: "3 rulings await a second examiner" },
    { id: "g5", label: "Completeness gate cleared", passed: false, detail: "package contradicts the intake sign-off" },
  ],
  releasable: false,
  blocked_reason: "Four gates are open. The report cannot compose until each is answered.",
  seal_sha256: null,
});

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

  http.post("/api/orders/:id/release", async ({ request }) => {
    const body = (await request.json()) as { signature?: string };
    if (!body?.signature) {
      return HttpResponse.json({ error: "a release is refused without its signature" }, { status: 422 });
    }
    return HttpResponse.json(
      { error: "four gates are open — the release gate refuses" },
      { status: 409 },
    );
  }),

  http.get("/api/orders/:id/artifacts", ({ params }) => {
    const body: ArtifactsResponse = {
      artifacts: [
        {
          id: "art_1",
          report_id: "rep_1",
          filename: `${String(params["id"])}-title-report-v1.pdf`,
          media_type: "application/pdf",
          bytes: 486_112,
          sha256: "7f8a92b104d3c61e5a0c2f88b17d4e9a3c5b8e21f0d7a64c9b3e5f1082a4c9e6",
          href: `/api/artifacts/art_1`,
        },
      ],
    };
    return HttpResponse.json(body);
  }),

  http.post("/api/deliveries/:id/reissue", async ({ request }) => {
    const body = (await request.json()) as { reason?: string };
    if (!body?.reason) {
      return HttpResponse.json({ error: "a reissue is refused without its reason" }, { status: 422 });
    }
    return HttpResponse.json({ error: "this order has no released version to supersede" }, { status: 409 });
  }),

  http.get("/api/orders/:id/countersigns", ({ params }) => {
    const body: CountersignsResponse = {
      order_id: String(params["id"]),
      required: [
        { field_id: "fld_jgmt_hit", path: "judgments.1.hit_identity", value: "SMITH, JOHN A.", ruled_by: "L. Vance", countersigned_by: null },
        { field_id: "fld_mtg_amount", path: "mortgages.1.amount", value: "$412,000", ruled_by: "L. Vance", countersigned_by: null },
        { field_id: "fld_legal_desc", path: "legal.description", value: "Lot 14, Block C", ruled_by: "L. Vance", countersigned_by: null },
      ],
    };
    return HttpResponse.json(body);
  }),

  http.post("/api/fields/:id/countersign", async ({ request }) => {
    const body = (await request.json()) as { signature?: string };
    if (!body?.signature) {
      return HttpResponse.json({ error: "a countersign is refused without a signature" }, { status: 422 });
    }
    return HttpResponse.json(
      { error: "a second read must come from a different examiner than the one who ruled" },
      { status: 409 },
    );
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
