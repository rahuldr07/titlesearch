import { realPackage } from "./realPackage.js";
import { http, HttpResponse } from "msw";
import type {
  CompositionResponse,
  Countersign,
  DeliveryWithReport,
  JurisdictionResponse,
  ManifestValue,
  OrderFilter,
  OrderRow,
  OrdersPageResponse,
  QuarantineResponse,
  ReissueResponse,
  ReissueReasonsResponse,
  CaptureScheduleResponse,
  ArtifactsResponse,
  CountersignsResponse,
  NaReason,
} from "@titlepipe/contract";
import { demoOrders, demoOrderRows, markOrderReleased, clearReleasedOverlay, overlayOrderRow, refOf, demoDeliveries, demoFields, demoTimelines, resetDemoTimelines } from "./data.js";
import { guard, guardAs } from "./guard.js";
import { appendAudit, auditActor } from "./audit.js";
import { TEMPLATE_VERSION } from "./templates.js";
import {
  STAND_IN,
  digestOf,
  hydratedOrder,
  noSourceCount,
  quarantineForBundle,
  syncHydratedStamp,
  type Bundle,
  type HydratedOrder,
  isOpen,
  sha256OfText,
} from "./packages.js";

/** One template version, quoted everywhere a screen prints it; re-exported
 * here because `handlers.ts` already imports it from this module. */
export { TEMPLATE_VERSION } from "./templates.js";

/** The client the demo orders belong to — the name `cli_riverbend` resolves to. */
export const CLIENT_NAME = "Riverbend Title";

const ASSIGNEES: Readonly<Record<string, string | null>> = {
  gate: "R. Okafor",
  review: "D. Okafor",
  escalated: "L. Vance",
  intake: "R. Delacroix",
  machine: null,
  unassigned: null,
  delivered: "D. Okafor",
};

/** Who holds an order, as the server answers it. Null while nobody does. */
export function assignedFor(o: (typeof demoOrders)[number]): string | null {
  return ASSIGNEES[o.stage] ?? null;
}

/**
 * The finished due labels ("Due today · 5h 20m left"), served per order and
 * demo-stable. Never derived from a timestamp in the browser — there is no
 * timestamp; the label is the fact.
 */
const SLA: Readonly<Record<string, string | null>> = {
  ord_demo_1: "Due today · 5h 20m left",
  ord_demo_2: "Due tomorrow 10:00 AM",
  ord_demo_4: "Due tomorrow 2:00 PM",
  ord_demo_5: "Due today · 7h 10m left",
  ord_demo_6: "Waiting on QC",
  ord_demo_7: "Due today · 6h 45m left",
  ord_demo_8: "Waiting on ops",
  ord_demo_9: "Due tomorrow 10:00 AM",
  ord_demo_10: "Due today · 6h 45m left",
  ord_demo_11: "Due in 2 days",
  ord_demo_12: "Delivered Aug 18",
  ord_demo_13: "Delivered Aug 16",
  ord_demo_14: "Due today · 3h 05m left",
};

/** The bar chip's whole string. Null = the server states no due at all. */
export function slaFor(o: (typeof demoOrders)[number]): string | null {
  return SLA[o.id] ?? null;
}

/**
 * The browse row's Due cell, derived server-side: delivered rows print the
 * word "delivered"; live rows drop the "Due today · " / "Due " / " left"
 * furniture.
 */
function dueCell(o: (typeof demoOrders)[number]): string | null {
  if (o.stage === "delivered") return "delivered";
  const sla = slaFor(o);
  if (sla === null) return null;
  return sla
    .replace(/^Due today · /, "")
    .replace(/^Due /, "")
    .replace(/ left$/, "");
}

function toRow(o: (typeof demoOrders)[number]): OrderRow {
  return {
    id: o.id,
    order_ref: o.order_ref,
    addr: o.addr,
    place: o.place,
    client: CLIENT_NAME,
    product: o.product,
    stage: o.stage as OrderRow["stage"],
    assigned_to: assignedFor(o),
    due: dueCell(o),
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
      const key = scoped?.[1] ?? "";
      // Own keys only — `constructor:x` must fall through to full-text search,
      // not resolve `fields.constructor` up the prototype chain to a function.
      if (scoped && Object.hasOwn(fields, key)) {
        const want = key === "ref" ? digits(scoped[2] ?? "") : (scoped[2] ?? "");
        return (fields[key] ?? "").includes(want);
      }
      /*
       * The ref is indexed with its punctuation stripped, so an unscoped term
       * has to be stripped the same way before it is compared against it —
       * every ref in the shop carries a hyphen, and comparing "demo-9001"
       * against "demo9001" meant that typing an order's own number into the
       * box the empty state says searches "by ref" returned nothing.
       */
      const bare = digits(term);
      return Object.entries(fields).some(([field, value]) =>
        value.includes(field === "ref" ? bare : term),
      );
    });
}

function inFilter(row: OrderRow, f: OrderFilter): boolean {
  if (f === "all") return true;
  if (f === "delivered") return row.stage === "delivered";
  if (f === "waiting") return row.stage === "gate" || row.stage === "escalated";
  return row.stage !== "delivered";
}

/** The order whose gates are green. */
const CLEARED_ORDER_ID = "ord_demo_14";

/**
 * The order the field fixture describes — quoted from `demoFields` because a
 * second copy of an id is a second answer. (`handlers.ts` quotes the same
 * cell as `FIELDS_ORDER_ID`; it imports this module, so it cannot be
 * imported here.)
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
 * The T1 second-read ledger, per order. One store answers both
 * `GET /orders/:id/countersigns` and gate g4 on the composition, so the two
 * endpoints cannot tell different stories about one order. Mutable for the
 * reason `seals` is: a filed countersign has to survive the request that
 * filed it, or the row could be second-read twice. An order with no entry
 * has no T1-tagged rulings — the empty list is the true answer.
 */
const seedCountersigns = (): [string, CountersignRow[]][] => [
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
];

const countersignStore = new Map<string, CountersignRow[]>(seedCountersigns());

/** Hydration's sink for the ledger: the T1-tagged fields of one order, all awaiting their second read. */
/** One row, upserted by field — a ruling re-made replaces its row rather than doubling it. */
export function fileCountersignRow(orderId: string, row: CountersignRow): void {
  const rows = (countersignStore.get(orderId) ?? []).filter((r) => r.field_id !== row.field_id);
  countersignStore.set(orderId, [...rows, row]);
}

export function fileCountersignRows(orderId: string, rows: CountersignRow[]): void {
  countersignStore.set(orderId, rows);
}

/**
 * File the second read on every open row of one order, as a named examiner.
 * The endpoint's own rule holds here: a countersign from the examiner who
 * ruled is not a second read, so a row ruled by this actor is left open
 * rather than quietly signed by them.
 */
export function countersignAllOpen(orderId: string, actor: string): void {
  for (const row of countersignStore.get(orderId) ?? []) {
    if (row.countersigned_by === null && row.ruled_by !== actor) row.countersigned_by = actor;
  }
}

/**
 * How many T1 rulings still await their second read, quoted from the
 * ledger. Exported for the fields census's `verdict_action`: the hub's CTA
 * names the second read only while the ledger actually holds one open.
 */
export function openCountersignCount(orderId: string): number {
  return (countersignStore.get(orderId) ?? []).filter((r) => r.countersigned_by === null).length;
}

/**
 * T1 fields on this order that nobody has ruled yet. ONE definition, read by
 * the ledger endpoint and by gate g4, so the panel and the gate cannot count
 * differently.
 *
 * Only a hydrated order can answer it here, and only a hydrated order needs
 * to. The live field store belongs to `handlers.ts`, which imports FROM this
 * module, so reaching back into it would be a cycle — and checked rather than
 * assumed: of the seeded fields, `demoFields` are all `ord_demo_1`, whose
 * three ruinous rulings are seeded straight into the ledger below, and
 * `ord_real_1`'s carry no `T1-` ref at all. So every seeded order either has
 * ledger rows already or has no ruinous exposure, and zero is its true
 * answer. A bundle's fields are the only ones that can be T1 and unruled.
 */
function unruledT1(orderId: string): number {
  const rec = hydratedOrder(orderId);
  if (rec === undefined) return 0;
  return rec.fields.filter((f) => f.rule_refs.some((r) => r.startsWith("T1-")) && isOpen(f.state))
    .length;
}

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
 * The delivery ledger this file mutates — the rows `GET /api/deliveries`
 * serves and the version ledger reads. The one store: `handlers.ts` holds no
 * delivery routes of its own, so every reader and writer of a delivery
 * touches these rows. One store, one answer.
 */
const seedDeliveries = (): DeliveryWithReport[] =>
  demoDeliveries.map((d) => ({
    ...d,
    receipt: d.receipt.map((step) => ({ ...step })),
    report: d.report ? { ...d.report } : null,
  }));

const deliveryStore: DeliveryWithReport[] = seedDeliveries();
let reissueCount = 0;

/**
 * Seals filed this page session, `order_id` → digest. The seal makes a
 * release irreversible, so it has to survive the request that made it — a
 * handler that recomputed `seal_sha256: null` on the next read would let the
 * same order be released twice. Reset on reload, like every other mutation
 * in this package.
 */
const seals = new Map<string, { sha256: string; at: string; version: number }>();

/**
 * Re-seed every mutable store this module owns — plus the timeline events its
 * countersign handler appended to `demoTimelines`. Called only by
 * `POST /api/demo/reset` (handlers.ts), which resets every store in the
 * package together.
 */
export function resetDesignStores(): void {
  deliveryStore.splice(0, deliveryStore.length, ...seedDeliveries());
  clearReleasedOverlay();
  reissueCount = 0;
  seals.clear();
  countersignStore.clear();
  for (const [orderId, rows] of seedCountersigns()) countersignStore.set(orderId, rows);
  resetDemoTimelines();
}

/**
 * Dispatch by id, a hydrated order first: the fallback is 4176034-1's sheet
 * reused as the stand-in for every uncleared demo order, and an uploaded
 * package must never be served another order's manifest.
 */
const composition = (orderId: string): CompositionResponse => {
  const rec = hydratedOrder(orderId);
  if (rec !== undefined) return hydratedComposition(orderId, rec);
  return orderId === CLEARED_ORDER_ID
    ? clearedComposition(orderId)
    : orderId === "ord_real_1"
      ? realComposition(orderId)
      : blockedComposition(orderId);
};

/** The four declared absences, as the delivered sheet prints them. One table for the jurisdiction rows and the hydrated sheet. */
const ABSENCE_SENTENCES: Readonly<Record<NaReason, string>> = {
  NOT_PRESENT: "N/A — expected in this jurisdiction",
  NOT_FOUND: "Searched — nothing of record",
  NOT_STATED: "Instrument silent",
  PRESENT_UNREADABLE: "Present — unreadable",
};

/** A sealed sheet's own sentence — the server's, not inferred from the digest. */
const SEALED_REASON =
  "This order was released and sealed. A release files once; a further copy is a reissue, not a release.";

const PENDING_SUFFIX = " — pending examiner confirmation";

type BundleBlockValue = Bundle["composition"]["blocks"][number]["values"][number];

/**
 * One row of a hydrated block, LIVE: the bundle names a field id; the row
 * prints that field's current state. Still queued or escalated → pending,
 * showing the value or a reading so the dashed link has something to jump
 * from, and `field_id` is the workstation PATH the jump lands on. Settled →
 * the ruled value, or the declared absence. No field behind the row → the
 * bundle's own words, verbatim.
 */
function liveValue(v: BundleBlockValue, rec: HydratedOrder): ManifestValue {
  const f = v.field_id === null ? undefined : rec.byBundleId.get(v.field_id);
  if (f === undefined) return { label: v.label, value: v.value, pending: v.pending, field_id: null };
  if (f.state === "needs_review" || f.state === "escalated") {
    const shown = f.value ?? (f.readings ?? []).find((r) => r.value !== null)?.value ?? v.value;
    return { label: v.label, value: `${shown}${PENDING_SUFFIX}`, pending: true, field_id: f.path };
  }
  const value = f.value ?? (f.na_reason === null ? v.value : ABSENCE_SENTENCES[f.na_reason]);
  return { label: v.label, value, pending: false, field_id: null };
}

/**
 * A hydrated order's own sheet: the bundle's blocks with live values, and
 * gates decided off the stores — g1 the field states, g2 the census, g4
 * the countersign ledger. g3 and g5 are the stand-ins the real package's
 * sheet carries, and say so.
 */
/**
 * g4 for a hydrated order. The ledger alone cannot answer it: a T1 field
 * still queued has no row yet (rows open with the first ruling), and an
 * empty ledger would read as "nothing to countersign". So the gate asks two
 * questions in order — has every T1 field been ruled, and has every ruling
 * been read a second time.
 */
function hydratedT1Gate(orderId: string): { passed: boolean; detail: string | null } {
  const unruled = unruledT1(orderId);
  if (unruled > 0) {
    return { passed: false, detail: unruled === 1 ? "1 T1 ruling not yet made" : `${String(unruled)} T1 rulings not yet made` };
  }
  return t1Gate(orderId);
}

function hydratedComposition(orderId: string, rec: HydratedOrder): CompositionResponse {
  const filed = seals.get(orderId) ?? null;
  const fields = rec.fields;
  // Escalated counts as open: a seal over an unresolved escalation would
  // certify a value nobody has ruled on.
  const queued = fields.filter((f) => isOpen(f.state)).length;
  const settled = fields.filter(
    (f) => f.state === "confirmed" || f.state === "corrected" || f.state === "escalated",
  ).length;
  const valued = fields.filter((f) => f.value !== null).length;
  const noSource = noSourceCount(fields);
  const gates: CompositionResponse["gates"] = [
    {
      id: "g1",
      label: "Every flagged decision answered",
      passed: queued === 0,
      detail:
        queued > 0
          ? `${String(queued)} still open`
          : settled === 0
            ? "nothing was queued for review"
            : `${String(settled)} of ${String(settled)} answered`,
    },
    {
      id: "g2",
      label: "Every value carries a citation",
      passed: noSource === 0,
      detail: `${String(valued - noSource)} of ${String(valued)} carry a page and a region`,
    },
    { id: "g3", label: "Chain of title unbroken through the statutory period", passed: true, detail: STAND_IN.chain },
    { id: "g4", label: "T1 second read countersigned", ...hydratedT1Gate(orderId) },
    { id: "g5", label: "Completeness gate cleared", passed: true, detail: STAND_IN.completeness },
  ];
  const open = gates.filter((g) => !g.passed).length;
  return {
    order_id: orderId,
    template_version: rec.bundle.composition.template_version,
    blocks: rec.bundle.composition.blocks.map((b) => ({
      id: b.id,
      numeral: b.numeral,
      title: b.title,
      values: b.values.map((v) => liveValue(v, rec)),
      field_count: b.field_count,
      cited: b.cited,
    })),
    gates,
    releasable: open === 0 && filed === null,
    blocked_reason:
      filed !== null
        ? SEALED_REASON
        : open === 0
          ? null
          : `${String(open)} gate${open === 1 ? " is" : "s are"} open. The report cannot compose until each is answered.`,
    // Open decisions and the second read both live on the workstation; a
    // sealed sheet's door is the delivered record.
    blocked_door: filed !== null ? "/delivery" : open === 0 ? null : `/orders/${orderId}/review`,
    seal_sha256: filed?.sha256 ?? null,
    released_at: filed?.at ?? null,
  };
}

/**
 * The real package's own sheet. `blockedComposition` is 4176034-1's document
 * reused as a stand-in for every uncleared order, which on the real package
 * put ANOTHER ORDER'S report on the compiler — the one thing a title
 * deliverable may never do. These blocks follow the package's own partition:
 * each value joins the instrument whose page range contains its citation.
 *
 * Three gates fail because the checks behind them have not been run on this
 * package, and saying so is the honest answer; two pass on facts the
 * extraction actually establishes.
 */
function realComposition(orderId: string): CompositionResponse {
  const filedSeal = seals.get(orderId);
  const gates: CompositionResponse["gates"] = [
    { id: "g1", label: "Every flagged decision answered", passed: true, detail: "nothing was queued for review" },
    { id: "g2", label: "Every value carries a citation", passed: true, detail: `${String(realPackage.fields.length)} of ${String(realPackage.fields.length)} carry a page and a region` },
    /*
     * STAND-INS, by owner instruction 2026-09-02, so the real package can be
     * walked end to end. Each says on the screen that it was not performed —
     * a gate that passes silently would be this fixture asserting a chain
     * analysis nobody ran, and that is the claim a title report may never
     * make. Re-close these the moment the stages exist.
     */
    { id: "g3", label: "Chain of title unbroken through the statutory period", passed: true, detail: STAND_IN.chain },
    { id: "g4", label: "T1 second read countersigned", passed: true, detail: "NOT PERFORMED — no ruinous-exposure classification exists, so nothing was classified or countersigned" },
    { id: "g5", label: "Completeness gate cleared", passed: true, detail: STAND_IN.completeness },
  ];
  return {
    order_id: orderId,
    template_version: TEMPLATE_VERSION,
    blocks: realPackage.composition.blocks.map((b) => ({
      ...b,
      values: b.values.map((v) => ({ ...v, field_id: null })),
    })),
    gates,
    releasable: true,
    blocked_reason: null,
    blocked_door: null,
    /* The filed seal, not a literal null — the screen reads these two to
       decide watermark vs stamp, and hardcoding null left a released order
       still drawing DRAFT. */
    seal_sha256: filedSeal?.sha256 ?? null,
    released_at: filedSeal?.at ?? null,
  };
}

/** A settled row — no pending flag, no jump target. */
const row = (label: string, value: string): ManifestValue => ({
  label,
  value,
  pending: false,
  field_id: null,
});

/**
 * A pending row: the amber " — pending examiner confirmation" sentence is
 * served, and `field_id` is the workstation field path the dashed underline
 * jumps to. Every path below is quoted from `demoFields`' needs_review rows
 * for the review order, so the jump lands on a field that genuinely awaits
 * a ruling.
 */
const pendingRow = (label: string, value: string, fieldPath: string): ManifestValue => ({
  label,
  value: `${value} — pending examiner confirmation`,
  pending: true,
  field_id: fieldPath,
});

/**
 * 4176028-5 — every gate answered, and the sheet is releasable until it is
 * released. Once it is, `seal_sha256` is the server's record that it happened.
 */
function clearedComposition(orderId: string): CompositionResponse {
  const filed = seals.get(orderId) ?? null;
  return {
    order_id: orderId,
    template_version: TEMPLATE_VERSION,
    blocks: [
      { id: "b1", numeral: "I", title: "Header information", values: [row("Order", "4176028-5"), row("Jurisdiction", "Clayton County, GA"), row("Product", "Two-owner search")], field_count: 6, cited: 6 },
      { id: "b2", numeral: "II", title: "Property identification", values: [row("Situs address", "310 Wrenfield Ln, Demoville GA"), row("Parcel", "13-0044-0231")], field_count: 5, cited: 5 },
      { id: "b3", numeral: "III", title: "Vesting & title chain", values: [row("Vested owner", "Adaline P. Rooke"), row("Instrument", "Warranty deed from Wrenfield Homes LLC")], field_count: 7, cited: 7 },
      { id: "b4", numeral: "IV", title: "Encumbrances & open liens", values: [row("Mortgage 1", "One open security deed to Ashfield Savings"), row("Secondary liens", "No other liens of record.")], field_count: 6, cited: 6 },
      { id: "b5", numeral: "V", title: "Tax assessment & status", values: [row("2025 installment", "Paid in full"), row("Assessment", "Land 31,500 · building 142,900")], field_count: 4, cited: 4 },
      { id: "b6", numeral: "VI", title: "Judgments & general liens", values: [row("1.", "Searched. Nothing indexed against the owner of record.")], field_count: 3, cited: 3 },
      { id: "b7", numeral: "VII", title: "Provenance & audit trail", values: [row("Citations", "Every value carries a page and line citation.")], field_count: 2, cited: 2 },
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
    blocked_reason: filed === null ? null : SEALED_REASON,
    // Nothing blocks a cleared sheet; a sealed one is blocked by its own seal,
    // and the door for THAT is the delivered record, not a work step.
    blocked_door: filed === null ? null : "/delivery",
    seal_sha256: filed?.sha256 ?? null,
    released_at: filed?.at ?? null,
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
  template_version: TEMPLATE_VERSION,
  /*
   * The pending rows below carry the workstation paths of 4176034-1's
   * needs_review fields (`demoFields`), so every amber dashed value on the
   * certificate jumps to a field that truly awaits its ruling. The blocked
   * composition is that order's sheet, reused as the fixture stand-in for
   * every order that is not cleared.
   */
  blocks: [
    { id: "b1", numeral: "I", title: "Header information", values: [row("Order", "4176034-1"), row("Jurisdiction", "Clayton County, GA"), row("Product", "40-year search")], field_count: 6, cited: 6 },
    { id: "b2", numeral: "II", title: "Property identification", values: [row("Situs address", "4152 Creekstone Dr, Demoville GA"), row("Parcel", "13-0044-0018"), pendingRow("Owner ZIP", "30310 / 30310-4418", "owner.zip")], field_count: 5, cited: 5 },
    { id: "b3", numeral: "III", title: "Vesting & title chain", values: [row("Vested owner", "Marlowe D. Quenby and Tessa R. Quenby"), row("Instrument", "Warranty deed"), pendingRow("Dated", "Instrument date unconfirmed", "deed.dated_date")], field_count: 7, cited: 7 },
    { id: "b4", numeral: "IV", title: "Encumbrances & open liens", values: [pendingRow("Mortgage 1 lender", "Two readings disagree on the lender of record", "mortgages.1.lender"), pendingRow("Mortgage 1 amount", "$412,000 / $412,900", "mortgages.1.amount"), row("Secondary liens", "One HOA lien, suppressed under R13.")], field_count: 9, cited: 8 },
    { id: "b5", numeral: "V", title: "Tax assessment & status", values: [row("2025 installment", "Paid"), row("Assessment", "Land 28,000 · building 158,400")], field_count: 4, cited: 4 },
    { id: "b6", numeral: "VI", title: "Judgments & general liens", values: [pendingRow("1.", "Judgment indexed — plaintiff attorney unresolved", "judgments.1.plaintiff_attorney"), pendingRow("Case number", "Two case series carry this caption", "judgments.1.case_no")], field_count: 3, cited: 2 },
    { id: "b7", numeral: "VII", title: "Provenance & audit trail", values: [row("Citations", "Every value carries a page and line citation.")], field_count: 2, cited: 2 },
  ],
  gates,
  releasable: false,
  blocked_reason: `${String(open)} gate${open === 1 ? " is" : "s are"} open. The report cannot compose until each is answered.`,
  // The step blocking release, as a door: open decisions and the second
  // read both live on the workstation, so that is the door.
  blocked_door: `/orders/${orderId}/review`,
  seal_sha256: null,
  released_at: null,
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

/**
 * The clerk-stamp fixture. The server reads jurisdiction off the recorded
 * clerk stamp during optical quarantine; the create handler stamps these
 * values on every order it files, and `quarantineBody` serves the same
 * values on `resolved`, so intake's read-only row and the order it signs
 * for can never disagree. This fixture is the only author of those three
 * members in the mock.
 */
export const CLERK_STAMP = {
  jurisdiction: "clayton-ga",
  state: "GA",
  county: "Clayton",
  pages: 64,
} as const;

/**
 * The digest a seed order's quarantine reports — the seed rows were never
 * uploaded this session, so there are no bytes to hash. Every upload
 * reports its real SHA-256 (`sha256Of`, packages.ts).
 */
const FIXTURE_DIGEST = "8e2f1d9a04cb6831b7c2a51e0d47f39a6c81b2e5470af9d3c6182b47e72df890";

/**
 * The gateway's verdicts, served both order-scoped
 * (`GET /orders/:id/quarantine`) and at the door
 * (`POST /api/intake/quarantine`, the pre-order scan run the moment a file
 * lands). A digest already on the books fails the de-dup step in the
 * server's words and resolves nothing — an unread stamp binds no rulebook.
 */
export function quarantineBody(
  orderId: string | null,
  duplicateOf: string | null,
  sha256: string,
): QuarantineResponse {
  return {
    order_id: orderId,
    sha256,
    duplicate_of: duplicateOf,
    steps: [
      { id: "av", label: "Antivirus scan", state: "passed", detail: "clean" },
      { id: "pdf", label: "Real PDF structure", state: "passed", detail: "64 pages, no embedded script" },
      duplicateOf === null
        ? { id: "sha", label: "De-duplication (SHA-256)", state: "passed", detail: "no prior intake with this digest" }
        : { id: "sha", label: "De-duplication (SHA-256)", state: "failed", detail: `duplicate package (sha256 match) — byte-identical to ${duplicateOf}` },
    ],
    optical: [
      { id: "dpi", label: "Raster resolution", value: "300 DPI · bitonal", ok: true, note: null },
      { id: "stamp", label: "Clerk stamp located", value: "p1 · Clayton County Superior Court", ok: true, note: null },
      { id: "contrast", label: "Contrast floor", value: "3 pages below", ok: false, note: "p7, p22, p29 — flagged under Law 3" },
    ],
    resolved:
      duplicateOf === null
        ? {
            jurisdiction: CLERK_STAMP.jurisdiction,
            state: CLERK_STAMP.state,
            county: CLERK_STAMP.county,
            page_count_label: `${String(CLERK_STAMP.pages)} pages (raster verified)`,
            jurisdiction_label: `${CLERK_STAMP.county} County, ${CLERK_STAMP.state}`,
            note_title: "Georgia overlay bound from clerk stamp",
            note_body: "Jurisdiction was read from the recorded clerk stamp on p1 — never hand-entered.",
          }
        : null,
  };
}

export const designHandlers = [
  http.get("/api/orders", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const filter = (url.searchParams.get("filter") ?? "all") as OrderFilter;
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const rows = demoOrderRows().map(toRow).filter((r) => inFilter(r, filter) && matches(r, q));
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
    const rec = hydratedOrder(orderId);
    if (rec === undefined && orderId !== CLEARED_ORDER_ID && orderId !== "ord_real_1") {
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
    if (rec !== undefined) {
      // A hydrated order's gates are live: the same sheet the compiler drew.
      const open = hydratedComposition(orderId, rec).gates.filter((g) => !g.passed).length;
      if (open > 0) {
        return HttpResponse.json(
          { error: `${open === 1 ? "one gate is" : `${String(open)} gates are`} open — the release gate refuses` },
          { status: 409 },
        );
      }
    }
    // The digest is over the composed manifest, which is what the seal claims
    // to fix. Seeded from the blocks so it could not be mistaken for a nonce.
    const composed =
      rec !== undefined
        ? hydratedComposition(orderId, rec)
        : orderId === "ord_real_1"
          ? realComposition(orderId)
          : clearedComposition(orderId);
    const manifest = composed.blocks
      .map((b) => `${b.numeral}:${b.title}:${b.values.map((v) => `${v.label}=${v.value}`).join(";")}`)
      .join("|");
    const filed = {
      // A hydrated order's seal IS the SHA-256 the screen names, over the
      // composed manifest. The seed orders keep their fixture digest.
      sha256: rec !== undefined ? await sha256OfText(manifest) : fixtureDigest(manifest),
      at: new Date().toISOString(),
      version: 1,
    };
    seals.set(orderId, filed);
    /*
     * A release MOVES the order. Filing only the seal left it reading
     * "Review" everywhere but the certificate — and left the delivered
     * record with nothing in it, so the artifact was unreachable.
     */
    markOrderReleased(orderId, filed.at);
    /*
     * What the release act DID: sign and record a digest. Nothing here
     * transmitted anything or heard a client acknowledge, so a hydrated
     * order's delivery stops at `digest_recorded` with the two remaining
     * steps undone and their instants null — the ReceiptStep invariant —
     * and the order row keeps `delivered_at` empty. The seed orders keep the
     * demo's completed receipt.
     */
    const hydrated = rec !== undefined;
    if (hydrated) overlayOrderRow(orderId, { delivered_at: null, waiting_on: "Sealed · awaiting transmission" });
    deliveryStore.unshift({
      id: `del_${orderId}`,
      report_id: `rep_${orderId}`,
      method: "portal",
      status: hydrated ? "digest_recorded" : "acknowledged",
      attempted_at: filed.at,
      delivered_at: hydrated ? null : filed.at,
      evidence: hydrated ? null : "filed in this session",
      receipt: [
        { id: "signed", at: filed.at, what: "Release signed & sealed", who: `${body.signature} · signed on this screen`, done: true },
        { id: "digest", at: filed.at, what: "SHA-256 digest recorded", who: "seal filed on the composition", done: true },
        hydrated
          ? { id: "transmit", at: null, what: "Transmitted · portal", who: "not yet transmitted", done: false }
          : { id: "transmit", at: filed.at, what: "Transmitted · portal", who: "portal accepted", done: true },
        hydrated
          ? { id: "ack", at: null, what: "Client acknowledged receipt", who: "not yet acknowledged", done: false }
          : { id: "ack", at: filed.at, what: "Client acknowledged receipt", who: "authorized user", done: true },
      ],
      report: {
        id: `rep_${orderId}`,
        order_id: orderId,
        // A hydrated order's report carries the package's own order number —
        // the reference printed on the package, which is what the report
        // was typed from.
        order_ref: rec !== undefined ? rec.bundle.package.order_ref : refOf(orderId),
        version: filed.version,
        shape: "A",
        rendered_at: filed.at,
        supersedes: null,
        reason: null,
      },
    });
    // A release is a moment of record — the audit ledger appends live.
    appendAudit(auditActor(request), "release_executed", "orders", orderId);
    return HttpResponse.json({
      order_id: orderId,
      version: filed.version,
      seal_sha256: filed.sha256,
      released_at: filed.at,
    });
  }),

  /*
   * One artifact per report actually delivered for this order — an order
   * with a v1 and a v2 has two rows, each joined to its own report. Read
   * from `demoDeliveries` — the immutable released record — and not from
   * `deliveryStore`, deliberately: a reissue draft lives only in the store,
   * and a draft has no certified artifact until it releases.
   */
  http.get("/api/orders/:id/artifacts", ({ params }) => {
    const orderId = String(params["id"]);
    const rec = hydratedOrder(orderId);
    if (rec !== undefined) {
      /*
       * Two certified deliverables, both real files with real digests, and
       * both only once the seal is filed — nothing is certified on a draft.
       *
       * The GENERATED REPORT: the bundle's `report`, verbatim. An empty
       * `sha256` means nothing has been rendered yet, and a zero-byte,
       * digest-less row on a certified record would be a claim, so the row
       * is absent until the renderer has run.
       *
       * THE PACKAGE ITSELF: the typed report's closing paragraph asks the
       * client to "review the enclosed search file", so the search file is
       * enclosed. Its digest is the one the gateway computed over the
       * uploaded bytes — the same hex the client can check against the file
       * they sent — and the dev middleware serves the file it was read from.
       */
      const { report, source, job, sha256 } = rec.bundle;
      const body: ArtifactsResponse = {
        artifacts: !seals.has(orderId)
          ? []
          : [
              ...(report.sha256 === ""
                ? []
                : [{
                    id: `art_rep_${orderId}`,
                    report_id: `rep_${orderId}`,
                    filename: report.filename,
                    media_type: report.media_type,
                    bytes: report.bytes,
                    sha256: report.sha256,
                    href: report.href,
                  }]),
              {
                id: `art_pkg_${orderId}`,
                report_id: `rep_${orderId}`,
                filename: source.filename,
                media_type: "application/pdf",
                bytes: source.bytes,
                sha256,
                href: `/scan/${job}/package.pdf`,
              },
            ],
      };
      return HttpResponse.json(body);
    }
    /*
     * The real package's artifact is the actual file — `/scan/package.pdf`,
     * the 8 MB bundle the readings were taken from, served by the dev
     * middleware from outside the tree. Every other order's artifact is a
     * fixture row with a synthetic digest; this one points at something a
     * reader can open, which is the whole reason the order exists.
     */
    const realSeal = orderId === "ord_real_1" ? seals.get(orderId) : undefined;
    if (realSeal !== undefined) {
      const real: ArtifactsResponse = {
        artifacts: [{
          id: "art_real_1",
          report_id: "rep_real_1",
          filename: "4087333-1 - Search Package.pdf",
          media_type: "application/pdf",
          bytes: 8_092_395,
          sha256: realSeal.sha256,
          href: "/scan/package.pdf",
        }],
      };
      return HttpResponse.json(real);
    }
    const body: ArtifactsResponse = {
      artifacts: demoDeliveries
        .flatMap((delivery) => {
          // A delivery whose report never rendered has no artifact to certify.
          const report = delivery.report;
          if (report === null || report.order_id !== orderId) return [];
          return [{
            id: `art_${delivery.report_id}`,
            report_id: delivery.report_id,
            /* The delivered file is named by the ORDER REF, as the client
               receives it — `ord_demo_12-title-report-v1.pdf` put an internal
               id on a document that leaves the building. */
            filename: `${report.order_ref ?? orderId}-title-report-v${String(report.version)}.pdf`,
            media_type: "application/pdf",
            bytes: 486_112 + report.version * 2_048,
            sha256: fixtureDigest(`${delivery.report_id}:v${String(report.version)}`),
            /*
             * NO FILE. These deliveries are seed rows — nothing was rendered
             * for them, so there are no bytes to fetch, and the address this
             * used to carry (`/api/artifacts/{id}`) was implemented by no
             * handler and backed by no disk. The row keeps its digest and the
             * screen states the absence; only a hydrated order, whose report
             * the renderer actually produced, carries a href.
             */
            href: null,
          }];
        }),
    };
    return HttpResponse.json(body);
  }),

  /*
   * The delivery list and retry, served off the same store the reissue
   * below appends to: a reissue that mutated a store the list never reads
   * would file a version nobody can see.
   */
  http.get("/api/deliveries", () => HttpResponse.json({ deliveries: deliveryStore })),

  /** Retry re-sends the same file — the report is never re-rendered. */
  http.post("/api/deliveries/:id/retry", ({ params, request }) => {
    const denied = guard(request, "delivery.retry");
    if (denied) return denied;
    const d = deliveryStore.find((x) => x.id === params["id"]);
    if (!d) return HttpResponse.json({ error: "no such delivery" }, { status: 404 });
    /*
     * Retry is the transit act on a bounced transmission and nothing else. A
     * draft has never been signed, so retrying one would transmit around the
     * signature act; every other status has already reached the wire and has
     * nothing to retry.
     */
    if (d.status !== "failed_transit") {
      return HttpResponse.json(
        { error: `only a failed transmission can be retried — this delivery is ${d.status}` },
        { status: 409 },
      );
    }
    const at = new Date().toISOString();
    d.status = "transmitted";
    d.delivered_at = at;
    d.evidence = "delivered on retry — same file, same report version";
    /*
     * The receipt is the record of the act, and the retry completes only the
     * transmit step. The ack step has not happened — it keeps `done: false`,
     * its null instant, and its own sentence (the ReceiptStep invariant).
     */
    d.receipt = d.receipt.map((step) =>
      step.done || step.id === "ack"
        ? step
        : { ...step, at, who: "retry — same file, same version", done: true },
    );
    return HttpResponse.json({ ok: true });
  }),

  /**
   * The Reissue Gateway's canned reasons, served. The vocabulary is the
   * server's, so the browser never puts its own words on the lender's
   * record.
   */
  http.get("/api/reissue/reasons", () => {
    const body: ReissueReasonsResponse = {
      reasons: [
        "A value in the delivered report requires correction or updating",
        "Client requested expansion of statutory search period (e.g. 40-year)",
        "An outstanding gap closed after initial delivery (e.g. 2023 county tax bill arrived)",
      ],
    };
    return HttpResponse.json(body);
  }),

  /*
   * Reissue — the one licensed act on a released version:
   *   - a delivery whose report exists names a released version; the
   *     reissue opens the next version as a draft row the version ledger
   *     reads, with the stated reason and the superseded version on the
   *     report (`Report.reason` / `Report.supersedes`);
   *   - one-way: while that draft is open the gateway is closed — a draft
   *     is not a released version, so there is nothing further to supersede;
   *   - a delivery with no report is refused: there truly is no released
   *     version behind it.
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
      order_ref: refOf(released.order_id),
      version: supersedes + 1,
      shape: released.shape,
      rendered_at: new Date().toISOString(),
      // The ledger's "Reason:" line and the superseded numeral, persisted
      // on the row rather than echoed once.
      supersedes,
      reason: body.reason,
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
      // The receipt's four steps, all still ahead of a draft.
      receipt: [
        { id: "signed", at: null, what: "Reissue signed & sealed", who: "awaiting examiner sign-off", done: false },
        { id: "digest", at: null, what: "SHA-256 digest recorded", who: "no digest until signed", done: false },
        { id: "transmit", at: null, what: "Transmitted · secure webhook", who: "not yet transmitted", done: false },
        { id: "ack", at: null, what: "Client acknowledged receipt", who: "not yet acknowledged", done: false },
      ],
    });
    // The reissue is a moment of record — the audit ledger appends live.
    appendAudit(auditActor(request), "reissue_draft_opened", "deliveries", `${released.order_id} v${String(report.version)}`);
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
      // The same figure gate g4 quotes, from the same place — a T1 field
      // nobody has ruled has no ledger row yet, and the screen has to be able
      // to say so rather than reading an empty list as "nothing is ruinous".
      unruled: unruledT1(orderId),
    };
    return HttpResponse.json(body);
  }),

  /*
   * A second read must come from a different examiner. The acting examiner is
   * the authenticated identity, resolved from the credential by `guardAs` —
   * the same convention `handlers.ts` uses to sign golden corrections, and
   * never the typed signature, which is a client field. A name the caller
   * could type is a name the caller could type twice, which would make the
   * different-examiner rule a formality the first examiner can satisfy alone.
   */
  http.post("/api/fields/:id/countersign", async ({ params, request }) => {
    const gate = guardAs(request, "field.countersign");
    if (gate.denied) return gate.denied;
    const body = (await request.json()) as { signature?: string };
    if (!body?.signature) {
      return HttpResponse.json({ error: "a countersign is refused without a signature" }, { status: 422 });
    }
    const fieldId = String(params["id"]);
    let row: CountersignRow | undefined;
    let ledgerOrderId: string | null = null;
    for (const [orderId, rows] of countersignStore.entries()) {
      row = rows.find((r) => r.field_id === fieldId);
      if (row !== undefined) {
        ledgerOrderId = orderId;
        break;
      }
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
    // The gate has already refused an unidentified caller, so what remains is
    // the rule itself: the seat that ruled cannot be the seat that reads it
    // back. `admin` ruled these rows in the seed, so an admin countersigning
    // its own ruling is refused here and a senior is not.
    const actor = gate.seat.actor;
    if (actor === row.ruled_by) {
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
    /*
     * When the last open T1 ruling on this order's ledger gains its second
     * read, the server appends the event to the order's timeline and the
     * trail re-reads it — never an optimistic append in the browser.
     */
    if (ledgerOrderId !== null) {
      const ledger = countersignStore.get(ledgerOrderId) ?? [];
      syncHydratedStamp(ledgerOrderId, ledger.filter((r) => r.countersigned_by === null).length);
      if (ledger.every((r) => r.countersigned_by !== null)) {
        const trail = (demoTimelines[ledgerOrderId] ??= []);
        trail.push({
          at: filed.at,
          kind: "countersigned",
          label: `${actor} countersigned ${String(ledger.length)} T1 ${ledger.length === 1 ? "ruling" : "rulings"} — second read complete`,
          detail: ledger.map((r) => r.path).join(" · "),
          attend: false,
        });
      }
    }
    // A countersign is a moment of record — the audit ledger appends live.
    appendAudit(actor, "field_countersigned", "fields", fieldId);
    return HttpResponse.json(filed);
  }),

  http.get("/api/orders/:id/quarantine", ({ params }) => {
    const orderId = String(params["id"]);
    const rec = hydratedOrder(orderId);
    if (rec !== undefined) return HttpResponse.json(quarantineForBundle(rec.bundle, orderId, rec.sha256, null, rec.pdf_header_ok));
    return HttpResponse.json(quarantineBody(orderId, null, digestOf(orderId) ?? FIXTURE_DIGEST));
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
      state === "GA"
        ? "Georgia"
        : state === "NY"
          ? "New York"
          : state === "NC"
            ? "North Carolina"
            : state === "MO"
              ? "Missouri"
              : state;
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
        { path: "legal.plat_book_page", label: "Plat book & page", reason: "NOT_PRESENT", renders_as: ABSENCE_SENTENCES.NOT_PRESENT },
        { path: "judgments.1.case_no", label: "Judgment case number", reason: "NOT_FOUND", renders_as: ABSENCE_SENTENCES.NOT_FOUND },
        { path: "vesting.consideration", label: "Consideration", reason: "NOT_STATED", renders_as: ABSENCE_SENTENCES.NOT_STATED },
        { path: "assessment.city_tax", label: "City tax", reason: "PRESENT_UNREADABLE", renders_as: ABSENCE_SENTENCES.PRESENT_UNREADABLE },
      ],
    };
    return HttpResponse.json(body);
  }),
];
