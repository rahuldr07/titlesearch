import { http, HttpResponse } from "msw";
import {
  TemplateSaveRequest,
  type TemplateCatalogResponse,
  type TemplateDetailResponse,
  type TemplateSheetBlock,
  type TemplateSummary,
} from "@titlepipe/contract";
import { guard, err } from "./guard.js";
import { appendAudit, auditActor } from "./audit.js";

/**
 * Templates Architect handlers — the catalog, the per-template detail, and
 * Save. One mutable store: a save PATCHes wording here and the next detail
 * read reflects it — the client never keeps an edited copy the server has
 * not accepted. Reset on reload, like every mutation in this package.
 */

/** Quoted by `GET /api/rail` (via design.ts) and the catalog's first card. */
export const TEMPLATE_VERSION = "v4.2";

const TOKENS: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  header: [["{{order_number}}", "4176034-1"], ["{{county}}", "Fulton County, Georgia"], ["{{effective_date}}", "08/14/2026"], ["{{product_name}}", "Current Owner Search"]],
  property: [["{{property_address}}", "1856 Defoor Ave NW, Atlanta, GA 30318"], ["{{parcel_id}}", "17-0178-0004-014-8"], ["{{legal_description}}", "Lot 14, Block C of Defoor Park subdivision, Land Lot 178, 17th District, Fulton County, Georgia, per plat at Plat Book 92, Page 41."]],
  vesting: [["{{grantee}}", "JOSEPH A. CALLAHAN ET UX"], ["{{grantor}}", "ARTHUR P. MOYER"], ["{{deed_type}}", "Warranty Deed"], ["{{deed_date}}", "11/28/2019"], ["{{recorded_date}}", "12/04/2019"], ["{{book_page}}", "61102 / 88"], ["{{page_number}}", "88"], ["{{instrument_no}}", "2019-0348911"], ["{{consideration}}", "$10.00 and other valuable consideration"]],
  encumbrances: [["{{instrument_type}}", "Security Deed"], ["{{borrower}}", "JOSEPH A. CALLAHAN"], ["{{lender}}", "WELLS FARGO BANK, N.A."], ["{{loan_amount}}", "$412,000.00"], ["{{recorded_date}}", "03/15/2020"], ["{{book_page}}", "62480 / 301"], ["{{open_assignments}}", "Assigned to Freedom Mortgage Corporation on 03/11/2021 at BK 63890 / PG 112."], ["{{maturity_date}}", "04/01/2050"]],
  taxes: [["{{tax_year}}", "2025"], ["{{amount_paid}}", "$4,182.16"], ["{{paid_date}}", "10/14/2025"], ["{{installment_status}}", "paid in full"], ["{{assessment_total}}", "$485,000"]],
  judgments: [["{{case_number}}", "Judgment 26-J-04412"], ["{{plaintiff}}", "DISCOVER BANK"], ["{{defendant}}", "SMITH, JOHN A."], ["{{original_amount}}", "$18,410.00"], ["{{recorded_date}}", "01/22/2026"], ["{{judgment_status}}", "Active and enforceable"]],
};

/** The product baseline each block's Split Diff compares against. */
const BASELINE: Readonly<Record<string, string>> = {
  header: "Order: {{order_number}} · County: {{county}} · Effective Date: {{effective_date}} · Product: {{product_name}}",
  property: "Address: {{property_address}} | Parcel: {{parcel_id}} | Legal: {{legal_description}}",
  vesting: "Vested in {{grantee}} by {{deed_type}} recorded {{recorded_date}} at {{book_page}}. Consideration: {{consideration}}.",
  encumbrances: "1. {{instrument_type}}, {{borrower}} to {{lender}}, {{loan_amount}}, BK {{book_page}}.",
  taxes: "{{tax_year}}: {{amount_paid}} paid {{paid_date}}.",
  judgments: "1. {{case_number}}, {{defendant}}, {{original_amount}}.",
};

/** The client's shipped wording — the reference's `blockWording` seed. */
const CLIENT_WORDING: Readonly<Record<string, string>> = {
  header: "Order: {{order_number}} · County: {{county}} · Effective Date: {{effective_date}} · Product: {{product_name}}",
  property: "{{property_address}} · Parcel ID {{parcel_id}} · Legal: {{legal_description}}",
  vesting: "Title is vested in {{grantee}} by {{deed_type}} dated {{deed_date}} and recorded {{recorded_date}} in Book {{book_page}} at Page {{page_number}}. Consideration: {{consideration}}.",
  encumbrances: "{{instrument_type}} from {{borrower}} to {{lender}} in the original amount of {{loan_amount}}, recorded {{recorded_date}} at Book {{book_page}}. {{open_assignments}}",
  taxes: "Tax Year {{tax_year}}: {{amount_paid}} {{installment_status}} on {{paid_date}}. Status: Paid in full. Total Assessment: {{assessment_total}}.",
  judgments: "{{case_number}}, {{plaintiff}} vs. {{defendant}}, in the amount of {{original_amount}}, recorded {{recorded_date}}. {{judgment_status}}.",
};

const NA: Readonly<Record<string, TemplateSheetBlock["na_matrix"]>> = {
  header: null,
  property: { structurally_absent: "N/A — Property identification invariant", not_found: "No parcel ID assigned of record in tax records", not_stated: "Metes and bounds legal description omitted on deed", unreadable: "Legal description unreadable on source deed" },
  vesting: { structurally_absent: "N/A — Document type carries no grantor/grantee", not_found: "None of record in county deed registry", not_stated: "Nominal / Not stated on instrument ($10.00 and other valuable consideration)", unreadable: "Unreadable on source deed — [Recording stamp obscuring text]" },
  encumbrances: { structurally_absent: "N/A — Not applicable for this search scope", not_found: "No open mortgages or deeds of trust of record", not_stated: "Maturity date not stated in security instrument", unreadable: "Unreadable on source document — [p19 scan degraded]" },
  taxes: { structurally_absent: "Exempt entity / N/A", not_found: "2023 tax installment not found in search package — pending portal pull", not_stated: "Tax assessment breakdown not stated by county collector", unreadable: "Tax receipt scan faded / unreadable" },
  judgments: { structurally_absent: "N/A — Out of scope for this search product", not_found: "No open judgments, tax liens, or UCC filings found of record", not_stated: "Judgment interest rate not stated on abstract", unreadable: "Judgment abstract blurred / unreadable on p31" },
};

const SHEET_ROWS: Readonly<Record<string, readonly { l: string; v: string; m: boolean }[]>> = {
  header: [
    { l: "Order Number:", v: "4176034-1", m: true },
    { l: "County / State:", v: "Fulton County, Georgia", m: false },
    { l: "Effective Date:", v: "08/14/2026", m: true },
    { l: "Product Scope:", v: "Current Owner Search", m: false },
  ],
  property: [
    { l: "Situs Address:", v: "1856 Defoor Ave NW, Atlanta, GA 30318", m: false },
    { l: "Parcel ID (APN):", v: "17-0178-0004-014-8", m: true },
    { l: "Legal Description:", v: "Lot 14, Block C of Defoor Park subdivision, Land Lot 178, 17th District, Fulton County, Georgia, per plat at Plat Book 92, Page 41.", m: false },
  ],
  vesting: [
    { l: "Vested In:", v: "JOSEPH A. CALLAHAN ET UX", m: true },
    { l: "Conveyance Type:", v: "Warranty Deed", m: false },
    { l: "Recorded:", v: "12/04/2019 · BK 61102 / PG 88", m: true },
    { l: "Consideration:", v: "$10.00 and other valuable consideration", m: false },
  ],
  encumbrances: [
    { l: "Mortgage 1:", v: "Security Deed, Callahan to Wells Fargo, BK 62480 / PG 301 — $412,000.00", m: false },
    { l: "Assignments:", v: "Assigned to Freedom Mortgage Corporation 03/11/2021 · BK 63890 / PG 112", m: false },
  ],
  taxes: [
    { l: "2025:", v: "$4,182.16 paid 10/14/2025 (City & County)", m: true },
    { l: "2024:", v: "$3,974.02 paid 10/09/2024", m: true },
    { l: "2023:", v: "2023 tax installment not found in search package — pending portal pull", m: true },
  ],
  judgments: [
    { l: "1.", v: "Judgment 26-J-04412, Discover Bank vs. SMITH, JOHN A., $18,410.00, recorded 01/22/2026.", m: false },
    { l: "2.", v: "No federal tax liens, state tax executions, or UCC filings of record.", m: false },
  ],
};

const BLOCK_TITLES: readonly (readonly [string, string, string])[] = [
  ["header", "Header information", "Product Rule P-CO-1 · Structure Locked"],
  ["property", "Property identification", "Product Rule P-CO-2 · Structure Locked"],
  ["vesting", "Vesting & title chain", "Product Rule P-CO-3 · Structure Locked"],
  ["encumbrances", "Encumbrances & open liens", "Product Rule P-CO-4 · Structure Locked"],
  ["taxes", "Tax assessment & status", "Product Rule P-CO-5 · Structure Locked"],
  ["judgments", "Judgments & general liens", "Product Rule P-CO-6 · Structure Locked"],
];

interface TemplateRecord extends TemplateSummary {
  sha256: string;
  source_ref: string;
  source_citation: string;
  sample_ids: readonly string[];
  /** Mutable — the drawn Save PATCHes this. */
  wording: Record<string, string>;
  draft_saved: boolean;
}

const SAMPLE_DOCS = [
  { id: "mc_01", name: "sample_mc_atlanta_co_2026.pdf", doc_id: "DOC-884-A", uploaded: "Aug 02, 2026", blocks_extracted: 8, notes: "Standard Fulton County format with MERS disclaimer", snippet: "TITLE IS VESTED IN Joseph A. Callahan et ux by Warranty Deed recorded 12/04/2019 at BK 61102 / PG 88. Consideration: $10.00.", box: "[142, 320, 684, 410]", page: 2 },
  { id: "mc_02", name: "sample_mc_dekalb_refi_2025.pdf", doc_id: "DOC-721-C", uploaded: "Jul 19, 2026", blocks_extracted: 6, notes: "Refinance package with open HELOC and satisfaction rider", snippet: "Taxes for tax year 2025 paid in full in the amount of $4,182.16 on 10/14/2025.", box: "[510, 110, 780, 230]", page: 4 },
  { id: "or_01", name: "sample_or_fulton_to_2026.pdf", doc_id: "DOC-910-B", uploaded: "Jul 14, 2026", blocks_extracted: 10, notes: "Two-owner chain with quitclaim intermediate deed", snippet: "FEE SIMPLE TITLE is confirmed in current owners per deed chain attached herein.", box: "[210, 290, 640, 390]", page: 1 },
  { id: "sl_01", name: "sample_sl_full_search_2026.pdf", doc_id: "DOC-405-D", uploaded: "Aug 09, 2026", blocks_extracted: 14, notes: "30-year full search abstract layout with probate schedule", snippet: "SEARCH PERIOD covers 30 years from earliest arm's length conveyance of record.", box: "[100, 150, 720, 260]", page: 2 },
  { id: "fa_01", name: "sample_fa_bringdown_2026.pdf", doc_id: "DOC-192-E", uploaded: "May 28, 2026", blocks_extracted: 4, notes: "Update report since prior title policy effective date", snippet: "BRINGDOWN SEARCH: No intervening encumbrances recorded between effective dates.", box: "[180, 220, 590, 310]", page: 1 },
] as const;

const templateStore: TemplateRecord[] = [
  { id: "tpl_mc_co_v4", name: "Current Owner Search (v4.2)", client: "Mortgage Connect", product: "Current Owner", version: TEMPLATE_VERSION, status: "active", mapped_fields: 132, total_fields: 132, sha256: "8e2f1d9a04cb68314e6b21908bf9321c172a39f60e909a34bc1a72df8901c341", source_ref: "sample_mc_atlanta_co_2026.pdf", source_citation: "Page 2, §3 (Vesting) & Page 4 (Taxes)", sample_ids: ["mc_01", "mc_02"], wording: { ...CLIENT_WORDING }, draft_saved: false },
  { id: "tpl_or_to_v2", name: "Two Owner Search (v2.1)", client: "Old Republic", product: "Two Owner", version: "v2.1", status: "active", mapped_fields: 132, total_fields: 132, sha256: "19ad420b910e5436c64fa829031ef19c8f0012ea88b02130e9d6d37fa1249b55", source_ref: "sample_or_fulton_to_2026.pdf", source_citation: "Page 1, §1 (Header) & Page 3 (Deeds)", sample_ids: ["or_01"], wording: { ...CLIENT_WORDING }, draft_saved: false },
  { id: "tpl_sl_fs_v1", name: "Full 30-Year Search (v1.0)", client: "ServiceLink", product: "Full Search", version: "v1.0", status: "draft", mapped_fields: 128, total_fields: 132, sha256: "53e71029cba45037d048b61c9203948e71624fa0e48bb6129841cae930129bc4", source_ref: "sample_sl_full_search_2026.pdf", source_citation: "Page 2, §4 (Chain of Title)", sample_ids: ["sl_01"], wording: { ...CLIENT_WORDING }, draft_saved: false },
  { id: "tpl_fa_up_v1", name: "Bringdown / Update (v1.4)", client: "First American", product: "Update", version: "v1.4", status: "active", mapped_fields: 48, total_fields: 48, sha256: "7401cd99e120894e6cba39410ea6789bf01208d132a890471b40219c6701ea18", source_ref: "sample_fa_bringdown_2026.pdf", source_citation: "Page 1 (Prior Effective Date)", sample_ids: ["fa_01"], wording: { ...CLIENT_WORDING }, draft_saved: false },
  { id: "tpl_mc_lo_v2", name: "Lien & Judgment Only (v2.0)", client: "Mortgage Connect", product: "Lien Only", version: "v2.0", status: "active", mapped_fields: 64, total_fields: 64, sha256: "09ba478201de94328cbef1a08321094ba18047ce90847291bac0192847201bba", source_ref: "sample_mc_atlanta_co_2026.pdf", source_citation: "Page 5, §2 (Judgment Matrix)", sample_ids: ["mc_01"], wording: { ...CLIENT_WORDING }, draft_saved: false },
];

/**
 * The label a saved draft carries: the template's OWN version, minor-bumped —
 * "v2.1" → "v2.2 draft". A version the rule cannot parse keeps its text with
 * "draft" appended rather than inventing a number.
 */
function nextDraftLabel(version: string): string {
  const m = /^v(\d+)\.(\d+)$/.exec(version);
  const major = m?.[1];
  const minor = m?.[2];
  if (major === undefined || minor === undefined) return `${version} draft`;
  return `v${major}.${String(Number(minor) + 1)} draft`;
}

const summary = (t: TemplateRecord): TemplateSummary => ({
  id: t.id,
  name: t.name,
  client: t.client,
  product: t.product,
  version: t.draft_saved ? `${t.version} → ${nextDraftLabel(t.version)}` : t.version,
  status: t.status,
  mapped_fields: t.mapped_fields,
  total_fields: t.total_fields,
});

function blocks(t: TemplateRecord): TemplateSheetBlock[] {
  return BLOCK_TITLES.map(([key, title, lock]) => ({
    key,
    title,
    lock_note: lock,
    rows: (SHEET_ROWS[key] ?? []).map((r) => ({ label: r.l, value: r.v, mono: r.m })),
    wording: t.wording[key] ?? "",
    baseline: BASELINE[key] ?? "",
    tokens: (TOKENS[key] ?? []).map(([token, sample]) => ({ token, sample })),
    na_matrix: NA[key] ?? null,
    overlay_note:
      key === "encumbrances"
        ? "State Overlay R-GA-01: Trustee line deleted for Georgia Security Deeds."
        : null,
  }));
}

/** The compiled spec, composed here — the browser prints it verbatim. */
function exportSpec(t: TemplateRecord): string {
  return JSON.stringify(
    {
      $schema: "https://titlepipe.dev/schemas/v4/template-definition.json",
      template_id: t.id,
      name: t.name,
      client: t.client,
      product_scope: t.product,
      version: t.version,
      status: t.status,
      sha256: t.sha256,
      precedence_rule: "state_content > product_shape > client_template_phrasing",
      sections: BLOCK_TITLES.map(([key]) => ({
        section_key: key,
        product_locked: true,
        expression: t.wording[key] ?? "",
        na_matrix: NA[key],
      })),
      state_overlays: {
        GA: {
          rule_id: "R-GA-01",
          action: "DELETE_TRUSTEE_LINE",
          reason: "Georgia security deeds do not carry trustees",
        },
      },
    },
    null,
    2,
  );
}

function detail(t: TemplateRecord): TemplateDetailResponse {
  return {
    ...summary(t),
    blocks: blocks(t),
    samples: t.sample_ids.flatMap((id) => {
      const doc = SAMPLE_DOCS.find((s) => s.id === id);
      return doc === undefined ? [] : [{ ...doc }];
    }),
    sha256: t.sha256,
    source_ref: t.source_ref,
    source_citation: t.source_citation,
    export_spec: exportSpec(t),
  };
}

export const templateHandlers = [
  http.get("/api/templates", () => {
    const body: TemplateCatalogResponse = {
      templates: templateStore.map(summary),
      clients: [...new Set(templateStore.map((t) => t.client))],
      products: [...new Set(templateStore.map((t) => t.product))],
    };
    return HttpResponse.json(body);
  }),

  http.get("/api/templates/:id", ({ params }) => {
    const t = templateStore.find((x) => x.id === String(params["id"]));
    if (t === undefined) return err("no such template", 404);
    return HttpResponse.json(detail(t));
  }),

  /** Save, guarded by `template.edit` — the 403 is the authz table on the wire. */
  http.patch("/api/templates/:id", async ({ params, request }) => {
    const denied = guard(request, "template.edit");
    if (denied) return denied;
    const t = templateStore.find((x) => x.id === String(params["id"]));
    if (t === undefined) return err("no such template", 404);
    const parsed = TemplateSaveRequest.safeParse(await request.json());
    if (!parsed.success) return err(parsed.error.message, 422);
    for (const [key, wording] of Object.entries(parsed.data.wording)) {
      if (!(key in t.wording)) return err(`no such block: ${key}`, 422);
      t.wording[key] = wording;
    }
    t.draft_saved = true;
    appendAudit(
      auditActor(request),
      "template_draft_saved",
      "templates",
      `${t.id} — ${t.client} · ${t.product}`,
    );
    return HttpResponse.json({
      id: t.id,
      version: nextDraftLabel(t.version),
      saved_at: new Date().toISOString(),
    });
  }),
];

/**
 * Re-seed this module's mutable members — the wording drafts. Called only by
 * `POST /api/demo/reset` (handlers.ts).
 */
export function resetTemplateStores(): void {
  for (const t of templateStore) {
    t.wording = { ...CLIENT_WORDING };
    t.draft_saved = false;
  }
}
