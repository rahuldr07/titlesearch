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
  demoOrderRow,
  demoOrders,
} from "./data.js";
import type { DemoOrderRow, DemoStageId } from "./data.js";

/**
 * The workspace, intake and admin resources.
 *
 * These were private constants inside individual screens for one build. They
 * live here now for the same reason every other fixture does: `packages/mocks`
 * IS the backend until the FastAPI core lands, and data a screen carries
 * privately is data no contract validates and no real API can replace.
 *
 * READS ONLY, except preferences. Publishing a grid, retiring a line, closing a
 * completeness gate and starting the pipeline are all state transitions the
 * server owns, and rulings Q4–Q10 have not settled what they mean. The screens
 * render these and say plainly that the write does not exist yet.
 *
 * EVERY ORDER-SHAPED ANSWER HERE IS A PROJECTION OF `demoOrders` (data.ts).
 * The board, the sign-off, the pipeline and the gate all read the SAME row, so
 * they cannot disagree about what state an order is in or how many pages its
 * package runs to. Where two answers were derived from two facts, they had
 * already drifted — `stages[signoff].phase: "done"` sat beside `signed_by:
 * null` and the sign-off row rendered "✓ Questions … open".
 *
 * Persons and places stay obviously synthetic (`Sample Client — Riverbend
 * Title`): a fixture that reads like a real file is a fixture somebody
 * eventually treats as one.
 */

// ---- products ---------------------------------------------------------------

/**
 * The six products, transcribed from the 2026-07-28 export
 * (`TitlePipe.dc.html:2276-2282`). The list carried a "30 Year Search" and a
 * "Two Owner Search" until 2026-07-30 while every order in `demoOrders` was a
 * 40-Year Search — a products grid that does not contain the product the live
 * order was placed under cannot explain a single thing on the sign-off screen.
 *
 * `full` for the year-40 row QUOTES `PRODUCT_NAME` rather than restating it:
 * the order table and this grid must name the same product with one string.
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
 * How a line applies to each PRODUCT FAMILY, not to each product id: the three
 * year products differ only in how far back they reach, and a line that
 * applies to a 20-year search applies to a 60-year search. `cellsOf` expands
 * the family to the ids, so adding an 80-Year Search is one line of edit.
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
  /** Exactly what THIS line may be answered. Six of the thirteen admit N/A. */
  readonly answers: readonly SignoffAnswer[];
  readonly comment_on_no: "req" | "opt";
  readonly machine_check: string | null;
  readonly standard_text: string | null;
  readonly period_scoped: boolean;
  /**
   * What the package must show for an N/A on this line to be checkable — the
   * export's `precondLabel` / `precondCount`. `null` where the product states
   * no precondition, which is the honest case: the gate cannot test the N/A.
   */
  readonly na_precondition: string | null;
  readonly ap: LineApplications;
  readonly scope: LineScope;
}

/**
 * THE PRODUCT'S THIRTEEN, transcribed from the 2026-07-28 export
 * (`TitlePipe.dc.html:2286-2298`) rather than paraphrased. They were thirteen
 * INVENTED lines until 2026-07-30, which made the questions screen, the
 * products grid and the rulebook each describe a different sign-off. One list,
 * three screens.
 *
 * `answers` and `comment_on_no` are per line and deliberately NOT uniform: N/A
 * is legal on six of them (L01, L04, L06, L08, L10, L11) and illegal on the
 * other seven, and a NO needs its comment on ten. The previous fixture
 * flattened `comment_on_no` to `true` on all thirteen and offered all three
 * answers everywhere, which turns two product rules into one screen-wide
 * habit — and invites an answer the sign-off cannot record.
 *
 * `machine_check` names what the pipeline can check the answer against. Where
 * it is `null` the line rests entirely on the abstractor's word, and the
 * completeness gate can raise no gap against it at all — which is exactly why
 * the fixture's one NO disclosure sits on a line the machine cannot contradict.
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
     * READS THIS TABLE rather than restating it, so a suggestion the sign-off
     * screen shows is the same fact the client record states. N/A is legal on
     * both (L08 and L10 admit it); a default naming an answer a line does not
     * accept would be a policy the sign-off could never record.
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

// ---- the lifecycle board -----------------------------------------------------

/**
 * The board's seven columns, the export's own ids, order, sub-lines and
 * waiting-on lines (`TitlePipe.dc.html:3269-3277`).
 *
 * THERE IS NO `failed` COLUMN, and that is a decision rather than an omission.
 * `OverviewScreen.tsx` lifts every order carrying `failed` into its banner, so
 * a `failed` column could not hold a card at any point in the product's life —
 * it would render permanently empty however many orders had failed. A failed
 * order sits in the stage it actually stopped in, flagged, and the banner
 * takes it from there.
 *
 * Intake is `halt`, not `idle`: an order sitting in intake is STOPPED, waiting
 * on a person to answer thirteen lines. `idle` belongs to Unassigned alone,
 * where nobody has taken the work yet and nothing is being held up.
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
  /**
   * The export prints "—" on this column's waiting-on line. A dash reads as a
   * value the fixture failed to supply; "nobody" is the fact — a delivered
   * order is out of the shop and is holding nothing up.
   */
  { id: "delivered", label: "Delivered", sub: "signed and sent", on: "nobody", kind: "done" },
];

/**
 * ONE ORDER IN THE SHOP'S BOOK THAT THIS FIXTURE DOES NOT CARRY, sitting in
 * Gates. The census counts every order in a stage; the card list is scoped to
 * what the caller may open, and `LifecycleStage.count` exists precisely so the
 * two can differ without the difference reading as work disappearing.
 *
 * Without it the two facts only ever differ for a reviewer, and the app's
 * default session is an admin — so the "+N you cannot open" case would have no
 * data to render in the demo at all. The census is therefore one larger than
 * the table, at every role, and `total` counts the same way: a board whose
 * columns sum to more than its own total would be the next contradiction.
 */
const CENSUS_ONLY_IN_GATE = 1;

function lifecycleCard(row: DemoOrderRow): LifecycleOrder {
  return {
    id: row.id,
    order_ref: row.order_ref,
    addr: row.addr,
    /** The board prints a place under the address; the row's `place` IS that line. */
    county: row.place,
    waiting_on: row.waiting_on,
    waited: row.waited,
    failed: row.failed,
    mine: row.mine,
    state_label: row.state_label,
  };
}

/**
 * The board, projected from `demoOrders`. It was a second, unrelated order list
 * until 2026-07-30 — the same orders under different refs, in different states,
 * with `addr: "—"` where the fixture had nothing to say.
 *
 * The role gate is the SHOP'S: a reviewer sees their own orders plus anything
 * unclaimed, which is the same gate `/api/queue/next` applies. The census is
 * not gated, and the scope note says so in the export's own words.
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
  /**
   * NULL, NOT FALSE — a person who has never touched the fold (2026-07-30,
   * Wave 2). `false` was an answer nobody gave, and it beat every route default
   * it was compared against, which made "Review starts collapsed" unreachable.
   * A new account has no preference; it acquires one by pressing the toggle.
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
 * The answers the abstractor actually gave on a SIGNED order. Every other line
 * is YES; these two are the interesting ones, and both are load-bearing
 * elsewhere:
 *
 *   L11 "N/A" is what the completeness gate's first gap is raised against —
 *   the abstractor read page 7 ("no plat of survey is of record") and answered
 *   N/A, while the classifier segmented a plat reference cover sheet at page
 *   18. Both are defensible, which is the whole point of the gate.
 *
 *   L13 "NO" is the one disclosure the review screen's abstractor-said-NO cards
 *   read. It sits on a line whose `machine_check` the package cannot satisfy
 *   and which the gate therefore cannot contradict — a NO the gate would ALSO
 *   have raised as a gap would be the fixture arguing with itself.
 *
 * A NO on a `comment_on_no: "req"` line without its comment is a refusal the
 * contract states; `NO_COMMENT` is why this table and that comment stay
 * together.
 */
const SIGNED_ANSWERS: Readonly<Record<string, SignoffAnswer>> = { L11: "N/A", L13: "NO" };
const NO_COMMENT =
  "No name-search, judgment or UCC index images were in the package — none could be attached to the report.";

/**
 * An order is SIGNED when it has moved past intake with a readable package.
 * One fact, derived once: the pipeline's sign-off row reads this function
 * rather than deciding for itself, which is what stops a done stage carrying
 * an open badge.
 */
function isSigned(row: DemoOrderRow | undefined): boolean {
  if (row === undefined || row.pages === null) return false;
  return row.stage !== "unassigned" && row.stage !== "intake";
}

/**
 * The sign-off for one order.
 *
 * The live order is signed and the intake order is not, because they are at
 * different stages and one endpoint cannot honestly say both. `answers` is the
 * line's own set, never the union of all three, and `policy_suggestion` names
 * WHICH answer the client's policy proposed — it is read from that client's
 * `signoff_defaults` above, so the suggestion the screen shows and the policy
 * the client record states are one fact.
 *
 * A SUGGESTION IS NEVER A GIVEN ANSWER (ruling Q13): the suggestion is served
 * only while the order is unsigned, and never written into `answer`.
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
 * The stage whose row carries a BADGE beyond its phase. Named rather than
 * assumed, because the rule below is about this pairing and a future badged
 * stage must opt into it rather than inherit it silently.
 */
export const BADGED_STAGE_ID = "signoff";

/** Stages an order can only be in if the completeness gate has already passed. */
const GATE_PASSED_STAGES: readonly DemoStageId[] = ["machine", "review", "escalated", "delivered"];

/**
 * A DONE STAGE MAY NEVER CARRY AN OPEN BADGE (ruled 2026-07-30).
 *
 * The sign-off row draws its checkmark from `phase` and its open/signed badge
 * from `signed_by` (`apps/web-v2/src/app/orderLifecycle.ts`). Both halves are
 * correctly server-cited, so a fixture that set one without the other rendered
 * "✓ Questions … open" and gave the reader no way to know which governed. The
 * two now come from ONE fact — `isSigned(row)` — and the fixture test fails if
 * they ever part company again.
 *
 * The stages are the export's eight (`TitlePipe.dc.html:2964-2973`), plus the
 * abstractor sign-off row the app's processing screen draws between classify
 * and the gate. "Validate & flag" and "Finalize & deliver" were missing
 * entirely, so nothing on that screen represented either validation or
 * delivery — the two steps a reader most wants to see before a report goes out.
 *
 * Every `waiting` row says WHY it has not run. "waits on the gate" told a
 * reader the order of the list, which they could already see.
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

  return {
    order_id: orderId,
    /**
     * CONTRACT GAP: `total_pages` is a plain int, so it cannot say "the package
     * could not be read". `demoOrders` says that with `pages: null`, and 0 is
     * the nearest expressible value — the ingest row beside it states the fact
     * in words. Widening this to `number | null` is a contract request Wave 2
     * did not make.
     */
    total_pages: pages ?? 0,
    /**
     * ONE classifier result, quoted from `PACKAGE_PAGES_RELEVANT`. Only the
     * live order's package is described page by page (`demoPages`), so a
     * per-order relevant count would be a number nobody could cite.
     */
    pages_relevant: PACKAGE_PAGES_RELEVANT,
    classifier_note: `The classifier found nothing the report needs on the other pages. You review ${PACKAGE_PAGES_RELEVANT}.`,
    /** Server state. `stage === "gate"` IS the halt; the screen never infers it. */
    gate_halted: stage === "gate" && signed,
    stages: [
      {
        id: "ingest",
        label: "Ingest & pre-process",
        detail: readable
          ? `Deskew, de-speckle, OCR · ${pages} pages`
          : "Halted — the cover could not be read, so the package was never counted.",
        owner: "Automated",
        phase: readable ? "done" : "halted",
      },
      {
        id: "classify",
        label: "Classify & segment",
        detail: readable
          ? `Two independent readers · ${PACKAGE_PAGES_RELEVANT} pages carried forward`
          : "Waits until the package can be read at all.",
        owner: "LLM agent",
        phase: readable ? "done" : "waiting",
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
 * The gate, and the gaps it raised against THIS order's sign-off.
 *
 * The gate reads the same thirteen lines the abstractor answered, which is why
 * every gap names its line number and quotes the machine check that disagreed.
 * The evidence cites the package — a page, a date, the page count — because a
 * gap that says only "the package disagrees" cannot be argued with, and being
 * argued with is exactly what a gap is for.
 *
 * Only the period gap gets a third way out: root of title is a fresh CLAIM and
 * a product change MOVES MONEY, and neither is available where an answer can
 * simply be amended. The three-across row on the card exists because this gap
 * has three.
 *
 * CONTRACT GAP: `OrderCompletenessResponse` cannot distinguish "the gate ran
 * and nothing is open" from "the gate has not run yet" — an empty `gaps` list
 * says both. Before sign-off this fixture serves the empty list with
 * `gate_open: false`, and the pipeline's gate row (`waiting`) is where the
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
