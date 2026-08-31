import { http, HttpResponse } from "msw";
import type {
  ClientsResponse,
  ConfigLine,
  ConfigResponse,
  EffectiveLine,
  GapCloseOption,
  LifecycleOrder,
  LifecycleResponse,
  LineApplication,
  MeProfileResponse,
  OrderCompletenessResponse,
  OrderPipelineResponse,
  OrderSignoffResponse,
  PeopleResponse,
  Preferences,
  SignoffAnswer,
  StageKind,
  StagePhase,
} from "@titlepipe/contract";
import { UpdatePreferencesRequest } from "@titlepipe/contract";
import {
  PACKAGE_PAGES,
  PACKAGE_PAGES_RELEVANT,
  PERIOD_LABEL,
  PRODUCT_NAME,
  demoFields,
  demoOrderRow,
  demoOrders,
  demoPages,
} from "./data.js";
import type { DemoOrderRow, DemoStageId } from "./data.js";

/**
 * The workspace, intake, and admin resources. Reads only, except
 * preferences — the writes are state transitions the server owns.
 *
 * Every order-shaped answer here is a projection of `demoOrders` (data.ts):
 * the board, the sign-off, the pipeline, and the gate all read the same row,
 * so they cannot disagree about an order's state or page count.
 *
 * Persons and places stay obviously synthetic ("Sample Client — Riverbend
 * Title"): a fixture that reads like a real file is a fixture somebody
 * eventually treats as one.
 */

// ---- products ---------------------------------------------------------------

/**
 * The six products. `full` for the year-40 row quotes `PRODUCT_NAME` rather
 * than restating it: the order table and this grid must name the same
 * product with one string.
 */
const products: ConfigResponse["products"] = [
  { id: "p_cos", code: "COS", full: "Current Owner Search", sub: "Current owner — vesting deed + open matters", period: "current owner", derivation: "cos", retired: false },
  { id: "p_tos", code: "TOS", full: "Two-Owner Search", sub: "Current owner + one prior owner", period: "current owner + one prior owner", derivation: "tos", retired: false },
  { id: "p_upd", code: "Update", full: "Update Search", sub: "New matter since a prior effective date", period: "since the prior effective date", derivation: "update", retired: false },
  { id: "p_y20", code: "20 Year", full: "20-Year Search", sub: "Full search · 20 years back", period: "20 years back", derivation: "y", retired: false },
  { id: "p_y40", code: "40 Year", full: PRODUCT_NAME, sub: "Full search · 40 years back", period: "40 years back", derivation: "y", retired: false },
  { id: "p_y60", code: "60 Year", full: "60-Year Search", sub: "Full search · 60 years back", period: "60 years back", derivation: "y", retired: false },
];

// ---- the product's thirteen sign-off lines -----------------------------------

const YN: readonly SignoffAnswer[] = ["YES", "NO"];
const YNA: readonly SignoffAnswer[] = ["YES", "NO", "N/A"];

const APPLIES: LineApplication = "applies";
const NARROWED: LineApplication = "narrowed";
const EXCLUDED: LineApplication = "excluded";

/**
 * How a line applies to each product family, not each product id: the year
 * products differ only in reach. `cellsOf` expands the family to the ids,
 * so adding an 80-Year Search is one line of edit.
 */
interface LineApplications {
  readonly cos: LineApplication;
  readonly tos: LineApplication;
  readonly update: LineApplication;
  readonly y: LineApplication;
}
type LineScope = Partial<Record<keyof LineApplications, string>>;

const ALL_PRODUCTS: LineApplications = { cos: APPLIES, tos: APPLIES, update: APPLIES, y: APPLIES };

function cellsOf(ap: LineApplications): Record<string, LineApplication> {
  return { p_cos: ap.cos, p_tos: ap.tos, p_upd: ap.update, p_y20: ap.y, p_y40: ap.y, p_y60: ap.y };
}

function scopeOf(scope: LineScope): Record<string, string> {
  const out: Record<string, string> = {};
  if (scope.cos !== undefined) out["p_cos"] = scope.cos;
  if (scope.tos !== undefined) out["p_tos"] = scope.tos;
  if (scope.update !== undefined) out["p_upd"] = scope.update;
  if (scope.y !== undefined) {
    out["p_y20"] = scope.y;
    out["p_y40"] = scope.y;
    out["p_y60"] = scope.y;
  }
  return out;
}

export interface SignoffLineSpec {
  readonly id: string;
  readonly n: number;
  readonly label: string;
  readonly group: string;
  /** Exactly what this line may be answered. Six of the thirteen admit N/A. */
  readonly answers: readonly SignoffAnswer[];
  readonly comment_on_no: "req" | "opt";
  readonly machine_check: string | null;
  readonly standard_text: string | null;
  readonly period_scoped: boolean;
  /**
   * What the package must show for an N/A on this line to be checkable.
   * `null` where the product states no precondition — the gate cannot test
   * the N/A.
   */
  readonly na_precondition: string | null;
  readonly ap: LineApplications;
  readonly scope: LineScope;
}

/**
 * The product's thirteen sign-off lines — one list, three screens.
 * `answers` and `comment_on_no` are per line and deliberately not uniform:
 * N/A is legal on six (L01, L04, L06, L08, L10, L11) and illegal on the
 * other seven, and a NO needs its comment on ten. `machine_check` names what
 * the pipeline can check the answer against; where null, the line rests
 * entirely on the abstractor's word and the gate can raise no gap against it.
 */
export const SIGNOFF_LINES: readonly SignoffLineSpec[] = [
  {
    id: "L01", n: 1, label: "Taxes and assessors pulled for all parcels", group: "Taxes",
    answers: YNA, comment_on_no: "req", machine_check: "Treasurer parcel record segmented",
    standard_text: null, period_scoped: false, na_precondition: "three parcels",
    ap: ALL_PRODUCTS, scope: {},
  },
  {
    id: "L02", n: 2, label: "Name search and GI run for all names", group: "Name search",
    answers: YN, comment_on_no: "req", machine_check: "Name/GI index result segmented",
    standard_text: null, period_scoped: true, na_precondition: null,
    ap: { cos: NARROWED, tos: NARROWED, update: NARROWED, y: APPLIES },
    scope: {
      cos: "current owner only",
      tos: "current + one prior owner",
      update: "names added since the prior effective date",
      y: "all names in the period",
    },
  },
  {
    id: "L03", n: 3, label: "Vesting deed names match per customer", group: "Vesting",
    answers: YN, comment_on_no: "req", machine_check: "Grantee vs order name compare",
    standard_text: null, period_scoped: false, na_precondition: null,
    ap: ALL_PRODUCTS, scope: {},
  },
  {
    id: "L04", n: 4, label: "Full Value Deed found", group: "Vesting",
    answers: YNA, comment_on_no: "req", machine_check: "FVD instrument segmented",
    standard_text: null, period_scoped: false, na_precondition: null,
    ap: { cos: APPLIES, tos: APPLIES, update: EXCLUDED, y: APPLIES }, scope: {},
  },
  {
    id: "L05", n: 5, label: "FVD covers PIQ; legal description page included", group: "Vesting",
    answers: YN, comment_on_no: "req", machine_check: null,
    standard_text: null, period_scoped: false, na_precondition: null,
    ap: { cos: APPLIES, tos: APPLIES, update: EXCLUDED, y: APPLIES }, scope: {},
  },
  {
    id: "L06", n: 6, label: "Deed chain complete", group: "Vesting",
    answers: YNA, comment_on_no: "req", machine_check: "Chain depth vs required span",
    standard_text: null, period_scoped: true, na_precondition: null,
    ap: { cos: EXCLUDED, tos: NARROWED, update: NARROWED, y: APPLIES },
    scope: {
      tos: "vesting deed and one prior",
      update: "from the prior effective date forward",
      y: "the full period",
    },
  },
  {
    id: "L07", n: 7, label: "All open mortgages and related documents considered", group: "Mortgages",
    answers: YN, comment_on_no: "req", machine_check: "Deed-of-trust instruments segmented",
    standard_text: null, period_scoped: false, na_precondition: null,
    ap: ALL_PRODUCTS, scope: {},
  },
  {
    id: "L08", n: 8, label: "Mortgage covering additional property: assessor + taxes", group: "Mortgages",
    answers: YNA, comment_on_no: "opt",
    machine_check: "Additional-property parcel + tax record segmented",
    standard_text: null, period_scoped: false,
    na_precondition: "a mortgage encumbering an additional parcel",
    ap: ALL_PRODUCTS, scope: {},
  },
  {
    id: "L09", n: 9, label: "All liens and UCC per standard criteria", group: "Name search",
    answers: YN, comment_on_no: "req", machine_check: "Lien/UCC index result segmented",
    standard_text: null, period_scoped: true, na_precondition: null,
    ap: { cos: NARROWED, tos: NARROWED, update: NARROWED, y: APPLIES },
    scope: {
      cos: "against the current owner",
      tos: "against both owners",
      update: "recorded since the prior effective date",
      y: "all owners in the period",
    },
  },
  {
    id: "L10", n: 10, label: "More than 10 judgments: first 10 listed, standard comment",
    group: "Name search", answers: YNA, comment_on_no: "opt", machine_check: null,
    standard_text:
      "“Additional judgments of record; first ten listed. Remaining matters available on request.”",
    period_scoped: false, na_precondition: null, ap: ALL_PRODUCTS, scope: {},
  },
  {
    id: "L11", n: 11, label: "Plat map, or tax/GIS map, included", group: "Legal",
    answers: YNA, comment_on_no: "opt", machine_check: "Plat/GIS image segmented",
    standard_text: null, period_scoped: false,
    na_precondition: "a plat or GIS image of record",
    ap: { cos: APPLIES, tos: APPLIES, update: EXCLUDED, y: APPLIES }, scope: {},
  },
  {
    id: "L12", n: 12, label: "Merging sequence followed", group: "Merging",
    answers: YN, comment_on_no: "req", machine_check: null,
    standard_text: "Stacking order: Vesting → Open DOTs → Liens/Judgments → Taxes → Legal/Plat.",
    period_scoped: false, na_precondition: null, ap: ALL_PRODUCTS, scope: {},
  },
  {
    id: "L13", n: 13, label: "Name search, judgment and UCC indexes provided", group: "Name search",
    answers: YN, comment_on_no: "req", machine_check: "Index images attached",
    standard_text: null, period_scoped: false, na_precondition: null,
    ap: ALL_PRODUCTS, scope: {},
  },
];

/** One line by id. Throws rather than inventing a line nobody wrote. */
function lineSpec(id: string): SignoffLineSpec {
  const spec = SIGNOFF_LINES.find((line) => line.id === id);
  if (spec === undefined) throw new Error(`no such sign-off line: ${id}`);
  return spec;
}

const lines: ConfigLine[] = SIGNOFF_LINES.map((spec): ConfigLine => ({
  id: spec.id,
  n: spec.n,
  label: spec.label,
  group: spec.group,
  answers: [...spec.answers],
  comment_on_no: spec.comment_on_no === "req",
  period_scoped: spec.period_scoped,
  machine_check: spec.machine_check,
  standard_text: spec.standard_text,
  version: 1,
  retired: false,
  cells: cellsOf(spec.ap),
  scope: scopeOf(spec.scope),
}));

// ---- clients and their overrides --------------------------------------------

const clients: ClientsResponse["clients"] = [
  {
    id: "cli_riverbend",
    code: "RVB",
    name: "Sample Client — Riverbend Title",
    product_ids: ["p_cos", "p_tos", "p_y40"],
    /**
     * The two lines this client's policy has an opinion about. `signoffFor`
     * reads this table rather than restating it. N/A is legal on both — a
     * default naming an answer a line does not accept would be a policy the
     * sign-off could never record.
     */
    signoff_defaults: { L08: "N/A", L10: "N/A" },
    overrides: [
      { id: "ov_1", type: "waive", line_id: "L11", description: "Plat or GIS map not required", note: "Client accepts metes-and-bounds descriptions with no plat of record.", authored_by: "M. Estrada", authored_at: "2026-05-12" },
      { id: "ov_2", type: "narrow", line_id: "L09", description: "Liens and UCC — county of record only", note: "Client does not pay for the statewide UCC sweep.", authored_by: "M. Estrada", authored_at: "2026-05-12" },
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
      { id: "ov_4", type: "replace", line_id: "L02", description: "Name search — statewide", note: "Replaces the county-scoped standard line.", authored_by: "L. Vance", authored_at: "2026-06-02" },
    ],
  },
];

/** The client the demo orders belong to — `demoOrders` says so, this quotes it. */
const liveClient = clients.find((client) => client.id === "cli_riverbend");

const effective: ClientsResponse["effective"] = [
  {
    client_id: "cli_riverbend",
    product_id: "p_y40",
    conflict: null,
    conflict_acknowledged: false,
    lines: lines.map((l): EffectiveLine => ({
      line_id: l.id,
      n: l.n,
      label: l.label,
      application: l.id === "L11" ? "excluded" : l.id === "L09" ? "narrowed" : "applies",
      override_id: l.id === "L11" ? "ov_1" : l.id === "L09" ? "ov_2" : null,
      scope_note: l.id === "L09" ? "county of record only" : null,
    })),
  },
  {
    client_id: "cli_hollowyn",
    product_id: "p_cos",
    conflict:
      "Override ov_4 replaces line 2 with a statewide name search, but the Current Owner product narrows line 2 to the current owner. The two cannot both hold.",
    conflict_acknowledged: false,
    lines: lines.map((l): EffectiveLine => ({
      line_id: l.id,
      n: l.n,
      label: l.label,
      application: (l.cells["p_cos"] ?? "applies") as LineApplication,
      override_id: l.id === "L02" ? "ov_4" : null,
      scope_note: l.id === "L02" ? "statewide — per client override" : null,
    })),
  },
];

/**
 * The intake client select's "(N sign-offs)" census — counted here off the
 * same effective checklists this endpoint serves, so the option and the
 * checklist it summarizes cannot drift, and no browser ever tallies it.
 */
for (const checklist of effective) {
  const client = clients.find((c) => c.id === checklist.client_id);
  if (client !== undefined && client.sign_offs === undefined) {
    const n = checklist.lines.filter((l) => l.application !== "excluded").length;
    client.sign_offs = `${String(n)} sign-offs`;
  }
}

// ---- the lifecycle board -----------------------------------------------------

/**
 * The board's seven columns. There is deliberately no `failed` column: the
 * overview lifts every failed order into its banner, so the column would
 * render permanently empty — a failed order sits in the stage it stopped in,
 * flagged. Intake is `halt`, not `idle`: an order in intake is stopped,
 * waiting on a person; `idle` belongs to Unassigned alone.
 */
const OV_DEF: readonly {
  id: DemoStageId;
  label: string;
  sub: string;
  on: string;
  kind: StageKind;
}[] = [
  { id: "unassigned", label: "Unassigned", sub: "nobody has taken it", on: "nobody", kind: "idle" },
  { id: "intake", label: "Intake & sign-off", sub: "answering the lines", on: "abstractor", kind: "halt" },
  { id: "machine", label: "Machine run", sub: "extracting fields", on: "machine", kind: "machine" },
  { id: "gate", label: "Gates", sub: "the run has stopped", on: "a person", kind: "halt" },
  { id: "review", label: "Review", sub: "decisions open", on: "reviewer", kind: "halt" },
  { id: "escalated", label: "Escalated", sub: "sent up", on: "senior", kind: "halt" },
  // "nobody", not "—": a delivered order is out of the shop and holds nothing up.
  { id: "delivered", label: "Delivered", sub: "signed and sent", on: "nobody", kind: "done" },
];

/**
 * One order in the shop's book that this fixture does not carry, sitting in
 * Gates — it keeps the census larger than the card list at every role so the
 * "+N you cannot open" case has data to render. `total` counts the same way:
 * columns must never sum past their own headline.
 */
const CENSUS_ONLY_IN_GATE = 1;

function lifecycleCard(row: DemoOrderRow): LifecycleOrder {
  return {
    id: row.id,
    order_ref: row.order_ref,
    addr: row.addr,
    /** The board prints a place under the address; the row's `place` is that line. */
    county: row.place,
    waiting_on: row.waiting_on,
    waited: row.waited,
    failed: row.failed,
    mine: row.mine,
    state_label: row.state_label,
  };
}

/**
 * The board, projected from `demoOrders`. The role gate: a reviewer sees
 * their own orders plus anything unclaimed — the same gate `/api/queue/next`
 * applies. The census is not gated, and the scope note says so.
 */
export function lifecycleFor(role: string): LifecycleResponse {
  const senior = role !== "reviewer";
  const visible = senior
    ? demoOrders
    : demoOrders.filter((row) => row.mine || row.stage === "unassigned");
  const censusOnly = (id: DemoStageId): number => (id === "gate" ? CENSUS_ONLY_IN_GATE : 0);
  const haltIds = OV_DEF.filter((stage) => stage.kind === "halt").map((stage) => stage.id);

  return {
    scope_note: senior
      ? "You are seeing every order in the shop."
      : "Scoped to your orders plus anything unclaimed — the same gate as the queue. A senior sees all of them.",
    total: demoOrders.length + CENSUS_ONLY_IN_GATE,
    halted:
      demoOrders.filter((row) => haltIds.includes(row.stage)).length + CENSUS_ONLY_IN_GATE,
    moving: demoOrders.filter((row) => row.stage === "machine").length,
    failed: demoOrders.filter((row) => row.failed).length,
    /*
     * The four stat cards. Labels and notes are authored here because the
     * server owns product copy; values come off the same table as every
     * census above, un-scoped like `total`.
     *   - `active` counts the census, so the invisible Gate order is in it.
     *   - `in_review` equals `stages[id="review"].count` by construction;
     *     the member exists so no client hardcodes the stage id.
     *   - `queries_and_gaps` is gate + escalated — the same bucket the
     *     browse endpoint's `waiting` filter names.
     *   - `delivered_recent` counts deliveries that arrived (`delivered_at`
     *     set), not the delivered stage — one order there is flagged
     *     failed-in-transit. A count, never a pace.
     */
    active: {
      label: "Total Active Queue",
      value:
        demoOrders.filter((row) => row.stage !== "delivered").length + CENSUS_ONLY_IN_GATE,
      note: "Open work, sorted by deadline",
    },
    in_review: {
      label: "In Examination Review",
      value: demoOrders.filter((row) => row.stage === "review").length,
      note: "Dual-engine values ready for human call",
    },
    queries_and_gaps: {
      label: "Open Queries & Gaps",
      value:
        demoOrders.filter((row) => row.stage === "gate" || row.stage === "escalated").length +
        CENSUS_ONLY_IN_GATE,
      note: "Awaiting QC or county portal records",
    },
    delivered_recent: {
      label: "Delivered This Week",
      value: demoOrders.filter((row) => row.delivered_at !== null).length,
      note: "Signed and sealed by an examiner",
    },
    stages: OV_DEF.map((stage) => ({
      id: stage.id,
      label: stage.label,
      sub: stage.sub,
      waiting_on: stage.on,
      kind: stage.kind,
      count: demoOrders.filter((row) => row.stage === stage.id).length + censusOnly(stage.id),
      orders: visible.filter((row) => row.stage === stage.id).map(lifecycleCard),
    })),
  };
}

// ---- people and profile ------------------------------------------------------

/**
 * Exported for the settings handlers: the role picker's PATCH mutates this
 * store, so `GET /api/people` reflects the change on re-read — one store,
 * one answer.
 */
export const people: PeopleResponse = {
  privileged_without_mfa: 1,
  // Roles are the RBAC matrix's column vocabulary (settings.ts ROLES4) —
  // the picker PATCHes against that list, so the seed rows speak it too.
  people: [
    { id: "u1", name: "L. Vance", email: "l.vance@titlepipe.internal", role: "QC Reviewer", privileged: true, status: "Active", mfa: "enrolled" },
    { id: "u2", name: "M. Okonkwo", email: "m.okonkwo@titlepipe.internal", role: "Typist (Reviewer)", privileged: false, status: "Active", mfa: "enrolled" },
    { id: "u3", name: "R. Okafor", email: "r.okafor@titlepipe.internal", role: "Typist (Reviewer)", privileged: false, status: "Active", mfa: "enrolled" },
    { id: "u4", name: "S. Whitfield", email: "s.whitfield@titlepipe.internal", role: "Typist (Reviewer)", privileged: false, status: "Suspended", mfa: "enrolled" },
    { id: "u5", name: "D. Pruitt", email: "d.pruitt@titlepipe.internal", role: "Engineer", privileged: true, status: "Active", mfa: "absent" },
    { id: "u6", name: "k.nyx@titlepipe.internal", email: "invitation sent 07/22", role: "Typist (Reviewer)", privileged: false, status: "Invited", mfa: "pending" },
  ],
};

/** Seed roles, captured for the demo reset — the role picker PATCH is the one writer. */
const seedRoles: readonly (readonly [string, string])[] = people.people.map((p) => [p.id, p.role]);

/**
 * Restore the people roles to their seed. Called only by `POST /api/demo/reset`
 * (handlers.ts). Deliberately NOT `preferences`: a preference survives the
 * demo reset for the same reason it survives a reload — it belongs to the
 * person, not to the demo data.
 */
export function resetWorkspaceStores(): void {
  for (const [id, role] of seedRoles) {
    const person = people.people.find((p) => p.id === id);
    if (person !== undefined) person.role = role;
  }
}

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
 * Preferences is the one resource here that accepts a write, and the only
 * mock store that must survive a page load — a preference that resets on
 * reload is not a preference. This is the mock's database, not the app's
 * storage: the app never touches browser storage (`check-rules` rejects it);
 * it does a real GET and PATCH over the wire.
 */
const PREFS_KEY = "titlepipe.mock.preferences";
const DEFAULT_PREFS: Preferences = {
  /**
   * Null, not false — a person who has never touched the fold. A new
   * account has no preference; it acquires one by pressing the toggle.
   */
  nav_collapsed: null,
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

// ---- the sign-off, per order -------------------------------------------------

const SIGNER = "R. Delacroix";
const SIGNED_AT = "2026-07-24T13:52:00Z";

/**
 * The answers the abstractor gave on a signed order. Every other line is
 * YES; these two are load-bearing elsewhere: L11 "N/A" is what the
 * completeness gate's first gap is raised against, and L13 "NO" is the one
 * disclosure the review screen's abstractor-said-NO cards read — it sits on
 * a line the gate cannot contradict, so the fixture never argues with
 * itself. A NO on a required-comment line must carry `NO_COMMENT`.
 */
const SIGNED_ANSWERS: Readonly<Record<string, SignoffAnswer>> = { L11: "N/A", L13: "NO" };
const NO_COMMENT =
  "No name-search, judgment or UCC index images were in the package — none could be attached to the report.";

/**
 * An order is signed when it has moved past intake with a readable package.
 * One fact, derived once: the pipeline's sign-off row reads this function
 * rather than deciding for itself, which is what stops a done stage
 * carrying an open badge.
 */
function isSigned(row: DemoOrderRow | undefined): boolean {
  if (row === undefined || row.pages === null) return false;
  return row.stage !== "unassigned" && row.stage !== "intake";
}

/**
 * The sign-off for one order. `answers` is the line's own set, never the
 * union of all three; `policy_suggestion` is read from the client's
 * `signoff_defaults`, so the suggestion shown and the policy stated are one
 * fact. A suggestion is never a given answer: it is served only while the
 * order is unsigned, and never written into `answer`.
 */
export function signoffFor(orderId: string): OrderSignoffResponse {
  const row = demoOrderRow(orderId);
  const signed = isSigned(row);
  const suggestions: Readonly<Record<string, string>> = liveClient?.signoff_defaults ?? {};

  return {
    order_id: orderId,
    signed_by: signed ? SIGNER : null,
    signed_at: signed ? SIGNED_AT : null,
    product_name: row?.product ?? PRODUCT_NAME,
    period_label: row?.period ?? PERIOD_LABEL,
    lines: SIGNOFF_LINES.map((spec) => {
      const raw = suggestions[spec.id];
      const suggestion: SignoffAnswer | null =
        raw !== undefined && spec.answers.includes(raw as SignoffAnswer)
          ? (raw as SignoffAnswer)
          : null;
      const answer: SignoffAnswer | null = signed ? (SIGNED_ANSWERS[spec.id] ?? "YES") : null;
      return {
        line_id: spec.id,
        n: spec.n,
        label: spec.label,
        group: spec.group,
        answers: [...spec.answers],
        answer,
        comment: answer === "NO" ? NO_COMMENT : null,
        comment_required: spec.comment_on_no === "req",
        machine_check: spec.machine_check,
        period_scoped: spec.period_scoped,
        prefilled_from_policy: !signed && suggestion !== null,
        policy_suggestion: signed ? null : suggestion,
      };
    }),
  };
}

// ---- the pipeline, per order -------------------------------------------------

/**
 * The stage whose row carries a badge beyond its phase. Named rather than
 * assumed: a future badged stage must opt in rather than inherit silently.
 */
export const BADGED_STAGE_ID = "signoff";

/** Stages an order can only be in if the completeness gate has already passed. */
const GATE_PASSED_STAGES: readonly DemoStageId[] = ["machine", "review", "escalated", "delivered"];

/**
 * A done stage may never carry an open badge. The sign-off row draws its
 * checkmark from `phase` and its open/signed badge from `signed_by`; both
 * come from one fact — `isSigned(row)` — and the fixture test fails if they
 * ever part company. Every `waiting` row says why it has not run, not just
 * where it sits in the list.
 */
export function pipelineFor(orderId: string): OrderPipelineResponse {
  const row = demoOrderRow(orderId);
  const stage: DemoStageId = row?.stage ?? "gate";
  const pages = row === undefined ? PACKAGE_PAGES : row.pages;
  const readable = pages !== null;
  const signed = isSigned(row);
  const gatePassed = GATE_PASSED_STAGES.includes(stage);
  const running = stage === "machine";
  const delivered = stage === "delivered";
  const deliveryFailed = delivered && row?.failed === true;
  const machinePhase: StagePhase = gatePassed && !running ? "done" : "waiting";
  const signoffPhase: StagePhase = signed ? "done" : readable && stage !== "unassigned" ? "halted" : "waiting";

  /*
   * The drawn figures, quoted from the same fixtures every other endpoint
   * quotes. Only the live review order has a described package and field
   * census; any other order gets the honest silence (nulls, an empty log)
   * rather than a borrowed number.
   */
  const doc = demoPages[orderId];
  const orderFields = demoFields.filter((f) => f.order_id === orderId);
  const fieldCount = orderFields.length;
  const flaggedCount = orderFields.filter((f) => f.state === "needs_review").length;
  const clearedCount = orderFields.filter((f) => f.state === "auto_confirmed").length;
  const instrumentCount = doc?.instruments.length ?? null;
  const degradedPages = (doc?.pages ?? []).filter((p) => p.degraded).map((p) => `p${String(p.n)}`);
  /* Whether extraction has served values for this order. Read off the same
     fixture `/fields` serves — for ord_demo_1 that endpoint serves cited
     values while the row sits at the gate; the log and the checks follow
     the fields, not the stage, so the two endpoints tell one story. */
  const extracted = doc !== undefined && fieldCount > 0;

  /* The dark terminal's lines — static demo telemetry, served only once
     extraction has actually run for this order. */
  const runLog =
    extracted
      ? [
          { time: "09:26:04", text: `Ingestion started · UUID ${orderId}`, warn: false, strong: false },
          { time: "09:26:11", text: `Pages split at 300 DPI · ${String(pages)} pages structured`, warn: false, strong: false },
          ...(degradedPages.length > 0
            ? [{ time: "09:26:48", text: `WARN: ${degradedPages.join(", ")} flagged below contrast floor (Law 3 limit)`, warn: true, strong: false }]
            : []),
          { time: "09:27:02", text: `${String(instrumentCount ?? 0)} recorded instruments successfully partitioned`, warn: false, strong: false },
          { time: "09:27:20", text: "Dual-engine NLP passing spatial verification…", warn: false, strong: false },
          { time: "09:27:40", text: `${String(fieldCount)} fields extracted with strict bounding-box provenance`, warn: false, strong: true },
          { time: "09:27:41", text: `${String(flaggedCount)} conflicts routed to examiner · ${String(clearedCount)} auto-cleared by hard validators`, warn: false, strong: false },
        ]
      : [];

  /* The hub's "Deterministic Verification Checks" — sentences only the
     pipeline can assert, so they ride its response. Empty until it has run. */
  const verifiedChecks =
    extracted
      ? [
          "Legal description on p8 matches the tax parcel on p2",
          "Every value on the draft points at a verifiable page and line citation",
          "Chain of title is unbroken back through the statutory period",
          ...(degradedPages.length > 0
            ? [`${degradedPages.join(", ")} explicitly recorded as unreadable, not collapsed into absent (Law 3)`]
            : []),
        ]
      : [];

  return {
    order_id: orderId,
    /**
     * CONTRACT GAP: `total_pages` is a plain int, so it cannot say "the
     * package could not be read". `demoOrders` says that with `pages: null`,
     * and 0 is the nearest expressible value — the ingest row beside it
     * states the fact in words.
     */
    total_pages: pages ?? 0,
    /**
     * One classifier result, quoted from `PACKAGE_PAGES_RELEVANT`. Only the
     * live order's package is described page by page (`demoPages`), so a
     * per-order relevant count would be a number nobody could cite.
     */
    pages_relevant: PACKAGE_PAGES_RELEVANT,
    classifier_note: `The classifier found nothing the report needs on the other pages. You review ${PACKAGE_PAGES_RELEVANT}.`,
    /** Server state. `stage === "gate"` is the halt; the screen never infers it. */
    gate_halted: stage === "gate" && signed,
    /* The meta strip's cells, the ETA chip, the terminal, and the hub's
       verified checks. All server-authored strings. */
    package_name: readable && row !== undefined ? `${row.order_ref}_package.pdf` : null,
    volume_label: readable ? `${String(pages)} Scanned Raster Pages` : null,
    eta_label: running
      ? "Extracting…"
      : gatePassed || extracted
        ? "Dual-Engine Extraction Complete"
        : readable
          ? "Awaiting the completeness gate"
          : "Awaiting a readable package",
    run_log: runLog,
    verified_checks: verifiedChecks,
    stages: [
      {
        id: "ingest",
        label: "Ingest & pre-process",
        detail: readable
          ? `Deskew, de-speckle, OCR · ${pages} pages`
          : "Halted — the cover could not be read, so the package was never counted.",
        owner: "Automated",
        phase: readable ? "done" : "halted",
        count: readable ? `${String(pages)} pages` : null,
      },
      {
        id: "classify",
        label: "Classify & segment",
        detail: readable
          ? `Two independent readers · ${PACKAGE_PAGES_RELEVANT} pages carried forward`
          : "Waits until the package can be read at all.",
        owner: "LLM agent",
        phase: readable ? "done" : "waiting",
        count: readable ? `${String(PACKAGE_PAGES_RELEVANT)} of ${String(pages)} pages` : null,
      },
      {
        id: BADGED_STAGE_ID,
        label: "Abstractor sign-off",
        detail: signed
          ? "Thirteen lines answered and signed."
          : readable
            ? "Waiting on you. The lines have not been answered."
            : "Waits until there is a readable package to answer against.",
        owner: "You",
        phase: signoffPhase,
        count: signed ? "13 lines" : null,
      },
      {
        id: "gate",
        label: "Completeness gate — checks the package against your sign-off",
        detail: gatePassed
          ? "Passed — the package supports every claim."
          : signed
            ? "Halted — the package contradicts your intake claims."
            : "Waits until the sign-off is signed — there is nothing to check yet.",
        owner: "Automated",
        phase: gatePassed ? "done" : signed ? "halted" : "waiting",
        count: null,
      },
      {
        id: "extract",
        label: "Extract fields",
        detail: running
          ? "Running — values pulled with page-line provenance."
          : gatePassed
            ? "Values pulled with page-line provenance."
            : "Held — an incomplete package never reaches extraction.",
        owner: "LLM agent",
        phase: running ? "running" : gatePassed ? "done" : "waiting",
        count:
          extracted
            ? instrumentCount === null
              ? `${String(fieldCount)} fields`
              : `${String(instrumentCount)} instruments × 2 engines · ${String(fieldCount)} fields`
            : null,
      },
      {
        id: "assemble",
        label: "Assemble draft",
        detail:
          machinePhase === "done"
            ? "Mapped into the Call Back Sheet sections."
            : "Waits until extraction has values to map.",
        owner: "Automated",
        phase: machinePhase,
        count: machinePhase === "done" ? "7 sections" : null,
      },
      {
        id: "validate",
        label: "Validate & flag",
        detail:
          machinePhase === "done"
            ? "Reader agreement checked · disagreements flagged."
            : "Waits until there is a draft to check the two readers against.",
        owner: "LLM agent",
        phase: machinePhase,
        count:
          machinePhase === "done" && fieldCount > 0
            ? `${String(clearedCount)} auto-cleared · ${String(flaggedCount)} flagged`
            : null,
      },
      {
        id: "qc",
        label: "Human QC gate — the run stops here for you",
        detail: delivered
          ? "All flags answered."
          : stage === "review" || stage === "escalated"
            ? "Waiting on you. Nothing is delivered until you approve every flag."
            : gatePassed
              ? "Waits until the machine run finishes."
              : "Waits until the completeness gate passes.",
        owner: "You",
        phase: delivered ? "done" : stage === "review" || stage === "escalated" ? "halted" : "waiting",
        count:
          (stage === "review" || stage === "escalated") && flaggedCount > 0
            ? `${String(flaggedCount)} flagged → you`
            : null,
      },
      {
        id: "finalize",
        label: "Finalize & deliver",
        detail: deliveryFailed
          ? "Halted — the deliverable rendered, and delivery to the client failed."
          : delivered
            ? "Word deliverable rendered, citation images embedded."
            : "Waits until every flag has been answered.",
        owner: "Automated",
        phase: deliveryFailed ? "halted" : delivered ? "done" : "waiting",
        count: delivered ? "v1 rendered" : null,
      },
    ],
  };
}

// ---- the completeness gate, per order ----------------------------------------

/**
 * The one option every gap offers. Uploading ADDS evidence and asserts
 * nothing, which is why it needs no comment and no role — and why it is
 * listed first on every card.
 */
const UPLOAD_OPTION: GapCloseOption = {
  kind: "upload",
  label: "＋ Upload the missing document",
  consequence: "Adds it to the package — it does not replace anything.",
  requires_comment: false,
  min_role: null,
};

const AMEND_FROM_NA_OPTION: GapCloseOption = {
  kind: "amend",
  label: "Change answer: N/A → answer it",
  consequence: "The precondition applies — re-answer the line. This is recorded.",
  requires_comment: false,
  min_role: null,
};

const AMEND_CLAIM_OPTION: GapCloseOption = {
  kind: "amend",
  label: "Amend claim: YES → NO",
  consequence: "Changes a signed assertion. This will be recorded.",
  requires_comment: false,
  min_role: null,
};

const ROOT_OF_TITLE_OPTION: GapCloseOption = {
  kind: "root_of_title",
  label: "⊢ Root of title reached",
  consequence:
    "Asserts the search is complete and nothing older exists. A claim — needs a comment.",
  requires_comment: true,
  min_role: null,
};

const CHANGE_PRODUCT_OPTION: GapCloseOption = {
  kind: "change_product",
  label: "Change the product ordered",
  consequence: "The client paid for this product. Senior/ops only, with a reason — recorded.",
  requires_comment: true,
  min_role: "senior",
};

/** How each gap was closed on an order that got past the gate. */
const CLOSED_NOTES: Readonly<Record<string, string>> = {
  g1: "Answer amended: N/A → NO. The page 18 sheet references a plat; none is of record.",
  g2: "Release recorded 06/02/2019 uploaded — added to the package, replacing nothing.",
  g3: "Root of title reached: the 2011 instrument is the root and nothing older is of record.",
};

/**
 * The gate, and the gaps it raised against this order's sign-off. Every gap
 * names its line number and quotes the machine check that disagreed; the
 * evidence cites the package, because a gap that only says "the package
 * disagrees" cannot be argued with. Only the period gap gets a third way
 * out: root of title is a fresh claim and a product change moves money.
 *
 * CONTRACT GAP: `OrderCompletenessResponse` cannot distinguish "the gate
 * ran and nothing is open" from "the gate has not run yet" — an empty
 * `gaps` list says both. Before sign-off this fixture serves the empty list
 * with `gate_open: false`; the pipeline's gate row (`waiting`) is where the
 * difference is currently readable.
 */
export function completenessFor(orderId: string): OrderCompletenessResponse {
  const row = demoOrderRow(orderId);
  const pages = row?.pages ?? PACKAGE_PAGES;
  const raised = isSigned(row);
  const passed = GATE_PASSED_STAGES.includes(row?.stage ?? "gate");
  const closure = (id: string) =>
    passed
      ? { closed_by: SIGNER, closed_note: CLOSED_NOTES[id] ?? null }
      : { closed_by: null, closed_note: null };

  const gaps: OrderCompletenessResponse["gaps"] = [
    {
      id: "g1",
      kind: "na_provisional",
      line_number: lineSpec("L11").n,
      line_label: lineSpec("L11").label,
      claim: `You answered N/A to sign-off line ${lineSpec("L11").n}.`,
      evidence: `${lineSpec("L11").machine_check ?? "The machine check"} — a plat reference cover sheet at page 18. The line's precondition is ${lineSpec("L11").na_precondition ?? "a signal from the package"}, so it should have been answered rather than passed over.`,
      close_options: [UPLOAD_OPTION, AMEND_FROM_NA_OPTION],
      ...closure("g1"),
    },
    {
      id: "g2",
      kind: "disagreement",
      line_number: lineSpec("L07").n,
      line_label: lineSpec("L07").label,
      claim: `You answered YES to sign-off line ${lineSpec("L07").n}.`,
      evidence: `The machine checked the package for the same line and disagrees: the security deed at page 12 carries no release or satisfaction — none found in the ${pages} pages.`,
      close_options: [UPLOAD_OPTION, AMEND_CLAIM_OPTION],
      ...closure("g2"),
    },
    {
      id: "g3",
      kind: "period_short",
      line_number: lineSpec("L06").n,
      line_label: lineSpec("L06").label,
      claim: `This order is a ${row?.product ?? PRODUCT_NAME} — ${row?.period ?? PERIOD_LABEL}. Line ${lineSpec("L06").n} requires the chain abstracted across that whole span.`,
      evidence: "The earliest instrument segmented is dated 03/14/2011 — only a 15-year span.",
      close_options: [UPLOAD_OPTION, ROOT_OF_TITLE_OPTION, CHANGE_PRODUCT_OPTION],
      ...closure("g3"),
    },
  ];

  return {
    order_id: orderId,
    gate_open: raised && !passed,
    product_name: row?.product ?? PRODUCT_NAME,
    period_label: row?.period ?? PERIOD_LABEL,
    gaps: raised ? gaps : [],
  };
}

// ---- handlers ----------------------------------------------------------------

/** The mock's JWT role claim; a missing header is the dev-default admin session. */
function roleOf(request: Request): string {
  const raw = request.headers.get("x-mock-role");
  return raw === null ? "admin" : raw;
}

export const workspaceHandlers = [
  http.get("/api/config/products", () =>
    HttpResponse.json({ config_version: "cfg-2026.07-3", frozen: true, products, lines } satisfies ConfigResponse),
  ),
  http.get("/api/clients", () => HttpResponse.json({ clients, effective } satisfies ClientsResponse)),
  http.get("/api/lifecycle", ({ request }) => HttpResponse.json(lifecycleFor(roleOf(request)))),
  http.get("/api/people", () => HttpResponse.json(people)),
  http.get("/api/me/profile", () => HttpResponse.json(profile)),

  http.get("/api/me/preferences", () => HttpResponse.json({ preferences })),
  /**
   * The one write here. Preferences are server-side — a preference in
   * localStorage silently resets on the machine somebody actually works on.
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
  /**
   * The "↺ Replay" control. Re-serves the stage timeline for the order; a
   * demo replay, not a re-run — nothing recomputes, no state transitions,
   * and the response is the same projection the GET serves.
   */
  http.post("/api/orders/:id/pipeline/replay", ({ params }) =>
    HttpResponse.json(pipelineFor(String(params["id"]))),
  ),
  http.get("/api/orders/:id/completeness", ({ params }) =>
    HttpResponse.json(completenessFor(String(params["id"]))),
  ),
];
