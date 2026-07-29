import { http, HttpResponse } from "msw";
import type {
  ClientsResponse,
  ConfigLine,
  ConfigResponse,
  EffectiveLine,
  LifecycleResponse,
  MeProfileResponse,
  OrderCompletenessResponse,
  OrderPipelineResponse,
  LineApplication,
  OrderSignoffResponse,
  PeopleResponse,
  Preferences,
} from "@titlepipe/contract";
import { UpdatePreferencesRequest } from "@titlepipe/contract";

/**
 * The workspace, intake and admin resources.
 *
 * These were private constants inside individual screens for one build. They
 * live here now for the same reason every other fixture does: `packages/mocks`
 * IS the backend until the FastAPI core lands, and data a screen carries
 * privately is data no contract validates and no real API can replace.
 *
 * READS ONLY, except preferences. Publishing a grid, retiring a line, closing a
 * completeness gap and starting the pipeline are all state transitions the
 * server owns, and rulings Q4–Q10 have not settled what they mean. The screens
 * render these and say plainly that the write does not exist yet.
 *
 * Values are obviously synthetic on purpose (`Sample Client — Riverbend
 * Title`): a fixture that reads like a real file is a fixture somebody
 * eventually treats as one.
 */

const YN = ["YES", "NO", "N/A"];

const products: ConfigResponse["products"] = [
  { id: "p_cos", code: "COS", full: "Current Owner Search", sub: "current vesting only", period: "current owner", derivation: "cos", retired: false },
  { id: "p_tos", code: "TOS", full: "Two Owner Search", sub: "back through two conveyances", period: "two owners", derivation: "tos", retired: false },
  { id: "p_y30", code: "30Y", full: "30 Year Search", sub: "full statutory period", period: "30 years", derivation: "y", retired: false },
  { id: "p_upd", code: "UPD", full: "Update / Bring-down", sub: "since the prior search", period: "since prior", derivation: "update", retired: false },
];

const LINE_SPECS: [number, string, string, string | null][] = [
  [1, "Search covers the full period ordered", "Period", "Recording dates span the ordered period"],
  [2, "All conveyances in the chain are reported", "Chain", "Chain has no unexplained gap"],
  [3, "Vesting deed identified and reported", "Chain", "A vesting deed is present"],
  [4, "Open mortgages and deeds of trust reported", "Liens", "Security instruments extracted"],
  [5, "Satisfied instruments excluded with reason", "Liens", null],
  [6, "Judgment and lien search run on all owners", "Name search", "Name index images attached"],
  [7, "Tax status reported for the current year", "Taxes", "A tax card is present"],
  [8, "Prior year taxes reported where unpaid", "Taxes", null],
  [9, "Legal description transcribed in full", "Legal", "Legal description extracted"],
  [10, "Plat or survey reference reported where of record", "Legal", null],
  [11, "Easements and restrictions of record reported", "Legal", null],
  [12, "Bankruptcy search run where required", "Name search", null],
  [13, "Name search, judgment and UCC indexes provided", "Name search", "Index images attached"],
];

const lines: ConfigLine[] = LINE_SPECS.map(([n, label, group, check]): ConfigLine => ({
  id: `L${n}`,
  n,
  label,
  group,
  answers: YN,
  comment_on_no: true,
  period_scoped: n === 1 || n === 2,
  machine_check: check,
  standard_text: null,
  version: 1,
  retired: false,
  cells: {
    p_cos: (n <= 4 || n === 7 || n === 9 ? "applies" : n === 6 ? "narrowed" : "excluded") as LineApplication,
    p_tos: (n === 12 ? "excluded" : n === 6 ? "narrowed" : "applies") as LineApplication,
    p_y30: "applies" as LineApplication,
    p_upd: (n === 1 || n === 2 || n === 4 || n === 7 ? "applies" : "excluded") as LineApplication,
  },
  scope: n === 6 ? { p_cos: "current owner only", p_tos: "both owners in the chain" } : {},
}));

const clients: ClientsResponse["clients"] = [
  {
    id: "cli_riverbend",
    code: "RVB",
    name: "Sample Client — Riverbend Title",
    product_ids: ["p_cos", "p_tos", "p_y30"],
    signoff_defaults: { L8: "N/A", L12: "N/A" },
    overrides: [
      { id: "ov_1", type: "waive", line_id: "L10", description: "Plat reference not required", note: "Client accepts metes-and-bounds descriptions without a plat cite.", authored_by: "M. Estrada", authored_at: "2026-05-12" },
      { id: "ov_2", type: "narrow", line_id: "L11", description: "Easements — recorded only", note: "Client does not want unrecorded easement commentary.", authored_by: "M. Estrada", authored_at: "2026-05-12" },
    ],
  },
  {
    id: "cli_hollowyn",
    code: "HLW",
    name: "Sample Client — Hollowyn Lending",
    product_ids: ["p_cos", "p_upd"],
    signoff_defaults: {},
    overrides: [
      { id: "ov_3", type: "add", line_id: null, description: "Flood zone determination attached", note: "Client-specific line, not in the standard 13.", authored_by: "L. Vance", authored_at: "2026-06-02" },
      { id: "ov_4", type: "replace", line_id: "L6", description: "Name search — statewide", note: "Replaces the county-scoped standard line.", authored_by: "L. Vance", authored_at: "2026-06-02" },
    ],
  },
];

const effective: ClientsResponse["effective"] = [
  {
    client_id: "cli_riverbend",
    product_id: "p_y30",
    conflict: null,
    conflict_acknowledged: false,
    lines: lines.map((l): EffectiveLine => ({
      line_id: l.id,
      n: l.n,
      label: l.label,
      application: l.id === "L10" ? "excluded" : l.id === "L11" ? "narrowed" : "applies",
      override_id: l.id === "L10" ? "ov_1" : l.id === "L11" ? "ov_2" : null,
      scope_note: l.id === "L11" ? "recorded easements only" : null,
    })),
  },
  {
    client_id: "cli_hollowyn",
    product_id: "p_cos",
    conflict:
      "Override ov_4 replaces line 6 with a statewide name search, but the Current Owner product narrows line 6 to the current owner. The two cannot both hold.",
    conflict_acknowledged: false,
    lines: lines.map((l): EffectiveLine => ({
      line_id: l.id,
      n: l.n,
      label: l.label,
      application: (l.cells["p_cos"] ?? "applies") as "applies" | "narrowed" | "excluded",
      override_id: l.id === "L6" ? "ov_4" : null,
      scope_note: l.id === "L6" ? "statewide — per client override" : null,
    })),
  },
];

const lifecycle: LifecycleResponse = {
  scope_note: "Orders you can see. The census counts every order in the stage, including ones you cannot open.",
  total: 9,
  halted: 4,
  moving: 1,
  failed: 2,
  stages: [
    { id: "intake", label: "Intake · sign-off open", kind: "idle", count: 2, orders: [
      { order_ref: "DEMO-0003", addr: "18 Marlin Way", county: "Clayton GA", waiting_on: "Sign-off open", waited: "waiting 1 d", failed: false },
    ] },
    { id: "gate", label: "Completeness gate", kind: "halt", count: 3, orders: [
      { order_ref: "DEMO-0004", addr: "72 Aldergate Rd", county: "Greene GA", waiting_on: "Gap: period short", waited: "waiting 2 d", failed: false },
      { order_ref: "DEMO-0005", addr: "9 Pellham Ct", county: "Houston GA", waiting_on: "Gap: N/A provisional", waited: "waiting 4 h", failed: false },
    ] },
    { id: "extract", label: "Extraction", kind: "machine", count: 1, orders: [
      { order_ref: "DEMO-0006", addr: "441 Kestrel Ln", county: "Mecklenburg NC", waiting_on: null, waited: null, failed: false },
    ] },
    { id: "review", label: "Review · decisions open", kind: "halt", count: 1, orders: [
      { order_ref: "DEMO-0001", addr: "4152 Creekstone Dr", county: "Clayton GA", waiting_on: "5 fields queued", waited: "waiting 3 h", failed: false },
    ] },
    { id: "escalated", label: "Escalated · sent up", kind: "halt", count: 0, orders: [] },
    { id: "failed", label: "Failed ingest", kind: "halt", count: 2, orders: [
      { order_ref: "DEMO-0007", addr: "—", county: "San Diego CA", waiting_on: "Package unreadable", waited: "waiting 6 h", failed: true },
    ] },
    { id: "delivered", label: "Delivered", kind: "done", count: 2, orders: [] },
  ],
};

const people: PeopleResponse = {
  privileged_without_mfa: 1,
  people: [
    { id: "u1", name: "L. Vance", email: "l.vance@titlepipe.internal", role: "Senior examiner", privileged: true, status: "Active", mfa: "enrolled" },
    { id: "u2", name: "M. Okonkwo", email: "m.okonkwo@titlepipe.internal", role: "Reviewer", privileged: false, status: "Active", mfa: "enrolled" },
    { id: "u3", name: "R. Okafor", email: "r.okafor@titlepipe.internal", role: "Reviewer", privileged: false, status: "Active", mfa: "enrolled" },
    { id: "u4", name: "S. Whitfield", email: "s.whitfield@titlepipe.internal", role: "Reviewer", privileged: false, status: "Suspended", mfa: "enrolled" },
    { id: "u5", name: "D. Pruitt", email: "d.pruitt@titlepipe.internal", role: "Engineer", privileged: true, status: "Active", mfa: "absent" },
    { id: "u6", name: "k.nyx@titlepipe.internal", email: "invitation sent 07/22", role: "Reviewer", privileged: false, status: "Invited", mfa: "pending" },
  ],
};

const profile: MeProfileResponse = {
  name: "L. Vance",
  email: "l.vance@titlepipe.internal",
  role: "Senior examiner",
  mfa: "enrolled",
  sessions: [
    { id: "s1", device: "Chrome · Windows", where: "Atlanta GA", last_seen: "now", current: true },
    { id: "s2", device: "Safari · iPad", where: "Atlanta GA", last_seen: "2026-07-26", current: false },
  ],
};

/**
 * Preferences is the one resource here that accepts a write, and the only mock
 * store that must SURVIVE A PAGE LOAD — a preference that resets on reload is
 * not a preference. Every other store in this package is deliberately
 * per-session, because no rule depends on them outliving the page.
 *
 * ⚠ THIS IS THE MOCK'S DATABASE, NOT THE APP'S STORAGE. `packages/mocks` stands
 * in for the server until the FastAPI core lands, and a server has somewhere to
 * put a row. The APP never touches browser storage — §9.11 forbids it and
 * `check-rules` rejects it — it does a real GET and PATCH over the wire, which
 * is exactly what this store exists to let the invariant prove. When the real
 * API arrives this goes with the rest of the handlers and the client is
 * unchanged.
 */
const PREFS_KEY = "titlepipe.mock.preferences";
const DEFAULT_PREFS: Preferences = {
  nav_collapsed: false,
  reduced_motion: false,
  default_zoom: 1,
  theme: "titlepipe",
};

function loadPrefs(): Preferences {
  try {
    const raw = globalThis.sessionStorage?.getItem(PREFS_KEY);
    if (raw === null || raw === undefined) return { ...DEFAULT_PREFS };
    const parsed: unknown = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...(parsed as Partial<Preferences>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

const preferences: Preferences = loadPrefs();

function savePrefs(): void {
  try {
    globalThis.sessionStorage?.setItem(PREFS_KEY, JSON.stringify(preferences));
  } catch {
    // A mock that cannot persist still serves the in-memory value.
  }
}

function signoffFor(orderId: string): OrderSignoffResponse {
  return {
    order_id: orderId,
    signed_by: null,
    signed_at: null,
    product_name: "Two Owner Search",
    period_label: "two owners",
    lines: LINE_SPECS.map(([n, label, group, check]) => ({
      line_id: `L${n}`,
      n,
      label,
      group,
      answer: null,
      comment: null,
      comment_required: true,
      machine_check: check,
      period_scoped: n === 1 || n === 2,
      prefilled_from_policy: n === 8 || n === 12,
    })),
  };
}

function pipelineFor(orderId: string): OrderPipelineResponse {
  return {
    order_id: orderId,
    total_pages: 38,
    pages_relevant: 11,
    classifier_note: "The classifier found nothing the report needs on the other pages. You review 11.",
    gate_halted: true,
    stages: [
      { id: "receive", label: "Package received", detail: "38 pages · 18.4 MB", owner: "Automated", phase: "done" },
      { id: "split", label: "Split and de-skew", detail: "38 page images", owner: "Automated", phase: "done" },
      { id: "classify", label: "Classify pages", detail: "11 pages carry fields the report needs", owner: "LLM agent", phase: "done" },
      { id: "signoff", label: "Abstractor sign-off", detail: "13 lines answered", owner: "You", phase: "done" },
      { id: "gate", label: "Completeness gate", detail: "3 gaps open — extraction is held", owner: "Automated", phase: "halted" },
      { id: "extract", label: "Extract fields", detail: "waits on the gate", owner: "LLM agent", phase: "waiting" },
      { id: "assemble", label: "Assemble draft", detail: "mapped into the Call Back Sheet sections", owner: "Automated", phase: "waiting" },
      { id: "review", label: "Review", detail: "waits on extraction", owner: "You", phase: "waiting" },
    ],
  };
}

function completenessFor(orderId: string): OrderCompletenessResponse {
  return {
    order_id: orderId,
    gate_open: true,
    product_name: "Two Owner Search",
    period_label: "two owners",
    gaps: [
      { id: "g1", kind: "na_provisional", line_label: "Plat or survey reference reported where of record", claim: "Answered N/A — no plat of record", evidence: "The package contains a plat page (p 9) the classifier recognised.", close_options: ["Amend the sign-off answer", "Assert root of title with a reason"], closed_by: null, closed_note: null },
      { id: "g2", kind: "disagreement", line_label: "Open mortgages and deeds of trust reported", claim: "Answered YES", evidence: "No satisfaction is recorded for the 2019 security deed, and no release page is in the package.", close_options: ["Upload the missing pages", "Amend the sign-off answer"], closed_by: null, closed_note: null },
      { id: "g3", kind: "period_short", line_label: "Search covers the full period ordered", claim: "Two Owner Search ordered", evidence: "Recorded instruments reach back one conveyance. The second owner is not covered by the package.", close_options: ["Upload the missing pages", "Change the product ordered"], closed_by: null, closed_note: null },
    ],
  };
}

export const workspaceHandlers = [
  http.get("/api/config/products", () =>
    HttpResponse.json({ config_version: "cfg-2026.07-3", frozen: true, products, lines } satisfies ConfigResponse),
  ),
  http.get("/api/clients", () => HttpResponse.json({ clients, effective } satisfies ClientsResponse)),
  http.get("/api/lifecycle", () => HttpResponse.json(lifecycle)),
  http.get("/api/people", () => HttpResponse.json(people)),
  http.get("/api/me/profile", () => HttpResponse.json(profile)),

  http.get("/api/me/preferences", () => HttpResponse.json({ preferences })),
  /**
   * The one write here. Preferences are server-side by decision C16 — a
   * preference in localStorage silently resets on the machine somebody
   * actually works on, and §9.11 forbids browser storage outright.
   */
  http.patch("/api/me/preferences", async ({ request }) => {
    const parsed = UpdatePreferencesRequest.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json({ error: parsed.error.message }, { status: 422 });
    }
    Object.assign(preferences, parsed.data);
    savePrefs();
    return HttpResponse.json({ preferences });
  }),

  http.get("/api/orders/:id/signoff", ({ params }) => HttpResponse.json(signoffFor(String(params["id"])))),
  http.get("/api/orders/:id/pipeline", ({ params }) => HttpResponse.json(pipelineFor(String(params["id"])))),
  http.get("/api/orders/:id/completeness", ({ params }) =>
    HttpResponse.json(completenessFor(String(params["id"]))),
  ),
];
