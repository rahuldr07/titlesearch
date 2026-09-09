import { z } from "zod";
import {
  FieldState,
  LineCoords,
  NaReason,
  OpticalReading,
  PackageInstrument,
  PipelineLogLine,
  SourceExcerpt,
  type CountersignsResponse,
  type Field,
  type OrderTimelineEvent,
  type QuarantineResponse,
} from "@titlepipe/contract";
import {
  acceptCreatedOrder,
  addCreatedOrder,
  demoOrderRow,
  demoPages,
  demoTimelines,
  overlayOrderRow,
  type DemoOrderRow,
} from "./data.js";
import sampleRaw from "./bundles/sample-package.json";
import lincolnRaw from "./bundles/final-package-lincoln-mo.json";

/**
 * Known packages: an upload whose real SHA-256 matches a registered bundle
 * hydrates the new order from that bundle, so every per-order read answers
 * from the stores rather than the honest silence a fresh package gets.
 *
 * A bundle is what the package-bundle generator emits for one county
 * package — pages, instruments, fields with their readings and their
 * ALREADY-DECIDED states, the composed blocks, the rendered report, and the
 * gateway/pipeline prose. Nothing here re-decides a state from a value:
 * the bundle says it, the write handlers transition it, exactly as they do
 * for `demoFields`.
 *
 * The real bundle names real people. Like `realPackage.json`, the committed
 * file is an empty placeholder and is populated locally by the generator;
 * a lookup against the placeholder throws by name rather than serving an
 * empty order as if the package had been read.
 */

// ---- the bundle shape --------------------------------------------------------

const BundleReading = z.object({
  id: z.string(),
  field_id: z.string(),
  engine_id: z.string(),
  value: z.string().nullable(),
  page: z.number().int().nullable(),
  snippet: z.string().nullable(),
  confidence_raw: z.number().nullable(),
  cost_usd: z.number(),
  latency_ms: z.number(),
  line_coords: LineCoords.nullable(),
});

const BundleField = z.object({
  id: z.string(),
  path: z.string(),
  section: z.string(),
  value: z.string().nullable(),
  na_reason: NaReason.nullable(),
  /** Decided by the generator's routing. Served verbatim, never re-derived. */
  state: FieldState,
  source_doc_id: z.string().nullable(),
  source_page: z.number().int().nullable(),
  source_snippet: z.string().nullable(),
  /**
   * The generator's split of the reader's own line, or null where it refused
   * to make one (the value is not in the snippet verbatim, or it is there
   * twice and there is no fact about which occurrence was matched). Never
   * re-split at serve time — the browser must not decide what the engine
   * matched, and neither must this module.
   */
  source_excerpt: SourceExcerpt.nullable(),
  source_line_coords: LineCoords.nullable(),
  engine_id: z.string().nullable(),
  engine_confidence_raw: z.number().nullable(),
  rule_refs: z.array(z.string()),
  approved_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  readings: z.array(BundleReading),
  asking: z.string().nullable(),
  why: z.string().nullable(),
  consequence: z.string().nullable(),
});

const BundlePage = z.object({
  n: z.number().int(),
  kind: z.string(),
  read_in_full: z.boolean(),
  degraded: z.boolean(),
  lines: z.array(z.string()),
  image_url: z.string().nullable(),
});

const BundleBlockValue = z.object({
  label: z.string(),
  value: z.string(),
  pending: z.boolean(),
  /** The bundle's own field id, not a path — mapped to the path at serve time. */
  field_id: z.string().nullable(),
});

const BundleBlock = z.object({
  id: z.string(),
  numeral: z.string(),
  title: z.string(),
  values: z.array(BundleBlockValue),
  field_count: z.number().int(),
  cited: z.number().int(),
});

const BundleTimelineEvent = z.object({
  kind: z.string(),
  label: z.string(),
  detail: z.string().nullable(),
  attend: z.boolean(),
});

export const Bundle = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  slug: z.string(),
  job: z.string(),
  source: z.object({ filename: z.string(), bytes: z.number().int(), pages: z.number().int() }),
  package: z.object({
    jurisdiction: z.string(),
    county: z.string(),
    state: z.string(),
    parcel: z.string(),
    situs: z.string(),
    owner_of_record: z.string(),
    stamp_page: z.number().int(),
    stamp_text: z.string(),
    order_ref: z.string(),
    order_ref_page: z.number().int(),
  }),
  engines: z.array(z.object({ id: z.string(), role: z.string(), pages_read: z.number().int() })),
  pages: z.array(BundlePage),
  instruments: z.array(PackageInstrument),
  fields: z.array(BundleField),
  composition: z.object({ template_version: z.string(), blocks: z.array(BundleBlock) }),
  report: z.object({
    filename: z.string(),
    media_type: z.string(),
    bytes: z.number().int(),
    /** Empty until the report is rendered — and then no artifact is certified. */
    sha256: z.string(),
    href: z.string(),
    shape: z.string(),
    version: z.number().int(),
  }),
  quarantine: z.object({
    optical: z.array(OpticalReading),
    resolved_note_title: z.string(),
    resolved_note_body: z.string(),
  }),
  pipeline: z.object({
    pages_relevant: z.number().int(),
    classifier_note: z.string(),
    package_name: z.string(),
    volume_label: z.string(),
    eta_label: z.string(),
    verified_checks: z.array(z.string()),
    run_log: z.array(PipelineLogLine),
  }),
  timeline: z.array(BundleTimelineEvent),
});
export type Bundle = z.infer<typeof Bundle>;

// ---- the registry --------------------------------------------------------------

/**
 * The committed bundle files, imported statically like `realPackage.json`
 * so a fresh public checkout builds. They ride in the mock chunk — which
 * `main.tsx` reaches only through `await import("@titlepipe/mocks/browser")`
 * — and never in the shell the size budget measures.
 */
const BUNDLE_FILES: readonly { name: string; raw: unknown }[] = [
  { name: "sample-package", raw: sampleRaw },
  { name: "final-package-lincoln-mo", raw: lincolnRaw },
];

/** The digest a file declares, read without parsing the rest of it. */
function declaredDigest(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const sha = (raw as { sha256?: unknown }).sha256;
  return typeof sha === "string" ? sha : null;
}

/** The committed shape: the header present, `fields` empty. */
function isPlaceholder(raw: unknown): boolean {
  const fields = (raw as { fields?: unknown }).fields;
  return !Array.isArray(fields) || fields.length === 0;
}

const parsedBundles = new Map<string, Bundle>();
const registeredForTest = new Map<string, Bundle>();
const warned = new Set<string>();

/**
 * The bundle registered under this digest, or undefined when the digest is
 * unknown. A matched placeholder is unknown too — the upload takes the
 * ordinary path — and says so once on the console with the command that
 * populates it, because a fresh checkout must keep working. A populated
 * file that fails to parse throws: that is a generator bug, and serving the
 * order empty would hide it.
 */
export function knownPackage(sha256: string): Bundle | undefined {
  const test = registeredForTest.get(sha256);
  if (test !== undefined) return test;
  for (const file of BUNDLE_FILES) {
    if (declaredDigest(file.raw) !== sha256) continue;
    if (isPlaceholder(file.raw)) {
      if (!warned.has(file.name)) {
        warned.add(file.name);
        console.warn(
          `[titlepipe/mocks] the upload matched bundles/${file.name}.json, which is the empty placeholder — ` +
            `populate it locally with: node packages/mocks/scripts/build-package-bundle.mjs`,
        );
      }
      return undefined;
    }
    const cached = parsedBundles.get(file.name);
    if (cached !== undefined) return cached;
    const parsed = Bundle.safeParse(file.raw);
    if (!parsed.success) {
      throw new Error(
        `packages/mocks/src/bundles/${file.name}.json is populated but is not a package bundle — ` +
          `regenerate it with: node packages/mocks/scripts/build-package-bundle.mjs ` +
          `(${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")})`,
      );
    }
    parsedBundles.set(file.name, parsed.data);
    return parsed.data;
  }
  return undefined;
}

/** The bytes whose digest the committed sample declares — a File of these reaches it through the real path. */
export const SAMPLE_PACKAGE_BYTES = "%PDF-1.4 sample package bytes";

/** The synthetic sample, parsed — for tests that register a variant of it. */
/**
 * The richest bundle this checkout actually holds, for the seeded completed
 * order. The real county package when it has been populated locally, the
 * synthetic sample when it has not — a completed exemplar made of the real
 * 112-field package is worth reading, and the placeholder that ships in VCS
 * is not something an order can be built from at all.
 *
 * Order matters: later entries in `BUNDLE_FILES` win, so the county package
 * beats the sample wherever both are populated.
 */
export function bestSeedBundle(): { bundle: Bundle; name: string } {
  let best = { bundle: sampleBundle(), name: "sample-package" };
  for (const file of BUNDLE_FILES) {
    if (file.name === "sample-package" || isPlaceholder(file.raw)) continue;
    const parsed = Bundle.safeParse(file.raw);
    if (parsed.success) best = { bundle: parsed.data, name: file.name };
  }
  return best;
}

export function sampleBundle(): Bundle {
  return Bundle.parse(sampleRaw);
}

/**
 * The stand-in gate sentences, by owner instruction 2026-09-02: a gate
 * whose check has not been built passes and SAYS SO on the screen. One
 * string each, quoted by the real package's sheet, the hydrated sheet and
 * the pipeline's gate row.
 */
export const STAND_IN = {
  chain: "NOT PERFORMED — stand-in for the demo; no chain analysis exists yet",
  completeness: "NOT PERFORMED — stand-in for the demo; no completeness check exists yet",
} as const;

/**
 * Test seam: register a bundle under a digest the test computed itself,
 * since a test cannot hold a county package's bytes. The bundle's own
 * `sha256` is overwritten with the key so the two cannot disagree.
 */
export function registerPackageForTest(sha256: string, bundle: Bundle): void {
  registeredForTest.set(sha256, { ...bundle, sha256 });
}

/** SHA-256 of the upload's bytes, lowercase hex. Browser and Node 22 both carry `crypto.subtle`. */
export async function sha256Of(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- session state --------------------------------------------------------------

type CountersignRow = CountersignsResponse["required"][number];

export interface HydratedOrder {
  readonly order_id: string;
  readonly sha256: string;
  readonly bundle: Bundle;
  /** The live objects `fieldStore` holds — one identity, so a confirm shows here. */
  readonly fields: Field[];
  /** Bundle field id → live field, for the composition's value links. */
  readonly byBundleId: ReadonlyMap<string, Field>;
  /** The gateway's %PDF header check on the uploaded bytes; null when no gateway read preceded the create. */
  readonly pdf_header_ok: boolean | null;
}

/** What hydration writes into, owned by other modules and handed in. */
export interface HydrationSinks {
  readonly fields: Field[];
  readonly countersign: (orderId: string, rows: CountersignRow[]) => void;
}

const hydratedById = new Map<string, HydratedOrder>();
/** Digest → order ref, for every order created this session, known bundle or not. */
const seenDigests = new Map<string, string>();
const digestByOrder = new Map<string, string>();

export function hydratedOrder(orderId: string): HydratedOrder | undefined {
  return hydratedById.get(orderId);
}

/** Newest first — the order `GET /api/queue/next` serves them in. */
export function hydratedOrderIds(): string[] {
  return [...hydratedById.keys()].reverse();
}

/** The ref of the order already filed under this digest, or null. */
export function duplicateOf(sha256: string): string | null {
  return seenDigests.get(sha256) ?? null;
}

/** A create that filed no bundle still books its digest, so a re-upload 409s. */
export function recordDigest(orderId: string, sha256: string, orderRef: string): void {
  seenDigests.set(sha256, orderRef);
  digestByOrder.set(orderId, sha256);
}

export function digestOf(orderId: string): string | undefined {
  return digestByOrder.get(orderId);
}

/** Drop every hydrated order. `POST /api/demo/reset` calls this beside the other resets. */
export function resetHydration(): void {
  for (const id of hydratedById.keys()) delete demoPages[id];
  hydratedById.clear();
  seenDigests.clear();
  digestByOrder.clear();
}

/**
 * The name the confirm handler stamps as `approved_by` — the examiner the
 * T1 ledger names as having ruled, same seat as the demo ledger's rows.
 */

/** A ruinous-exposure tag, as the rulebook writes them (`T1-lien-holder-identity`). */
const isT1 = (ref: string): boolean => ref.startsWith("T1-");

/** Still wants a person: queued, or parked behind an escalation nobody has resolved. */
export const isOpen = (state: Field["state"]): boolean => state === "needs_review" || state === "escalated";

/**
 * The second-read ledger row a FIRST ruling on a T1 field opens. Null for a
 * field no T1 rule tags. The row is filed when someone rules, never at
 * hydration: a row with `ruled_by` on a field still queued would attribute
 * a ruling nobody has made, and g4 would then ask a second examiner to
 * countersign nothing.
 */
export function t1RowFor(field: Field, actor: string): CountersignRow | null {
  if (!field.rule_refs.some(isT1)) return null;
  return { field_id: field.id, path: field.path, value: field.value, ruled_by: actor, countersigned_by: null };
}

/** Whether the upload's first five bytes are a PDF header — the one structural fact the gateway can check itself. */
export async function pdfHeaderOk(file: Blob): Promise<boolean> {
  return (await file.slice(0, 5).text()) === "%PDF-";
}

/** SHA-256 of a UTF-8 string, lowercase hex — the seal over a composed manifest. */
export async function sha256OfText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The header check's verdict per digest, noted at the door so the order's own quarantine read repeats it rather than re-asserting it. */
const pdfHeaderByDigest = new Map<string, boolean>();
export function notePdfHeader(sha256: string, ok: boolean): void {
  pdfHeaderByDigest.set(sha256, ok);
}

/**
 * Values the pipeline produced with no document, page or reading behind
 * them — the census's `no_source`, stated once for `/fields` and gate g2.
 */
export function noSourceCount(fields: readonly Field[]): number {
  return fields.filter(
    (f) =>
      f.value !== null &&
      f.source_doc_id === null &&
      f.source_page === null &&
      (f.readings ?? []).length === 0,
  ).length;
}

interface HydrationForm {
  readonly client_id: string;
  readonly external_ref: string;
  /** The product's served name, or the raw id when the config has no such product. */
  readonly product: string;
  readonly period: string;
}

/** Ids are prefixed with the order so two packages sharing `fld_1` cannot collide. */
function fieldOf(orderId: string, f: Bundle["fields"][number]): Field {
  const id = `${orderId}_${f.id}`;
  const field: Field = {
    id,
    order_id: orderId,
    path: f.path,
    value: f.value,
    na_reason: f.na_reason,
    state: f.state,
    source_doc_id: f.source_doc_id,
    source_page: f.source_page,
    source_snippet: f.source_snippet,
    source_excerpt: f.source_excerpt,
    source_line_coords: f.source_line_coords,
    engine_id: f.engine_id,
    engine_confidence_raw: f.engine_confidence_raw,
    rule_refs: [...f.rule_refs],
    approved_by: f.approved_by,
    approved_at: f.approved_at,
    readings: f.readings.map((r) => ({ ...r, id: `${orderId}_${r.id}`, field_id: id })),
  };
  // Present on a field that went to review, absent on one that never did —
  // the contract's three-way meaning, kept.
  if (f.state === "needs_review" || f.asking !== null || f.why !== null || f.consequence !== null) {
    field.asking = f.asking;
    field.why = f.why;
    field.consequence = f.consequence;
  }
  return field;
}

/** Stamp tone follows the open work: `action` while a decision or second read is owed. */
const STAMP_OPEN: Partial<DemoOrderRow> = { stamp_tone: "action", waiting_on: "Human QC gate" };
const STAMP_CLEARED: Partial<DemoOrderRow> = { stamp_tone: "settled", waiting_on: "Release signature" };

/**
 * Register the order and fill every store a per-order read answers from.
 * Once per digest per session: the create handler 409s a second upload of
 * the same bytes before it gets here.
 */
export function hydrateOrder(
  orderId: string,
  bundle: Bundle,
  form: HydrationForm,
  sinks: HydrationSinks,
  at: string,
  /**
   * A SEEDED order — one that was already in the shop when the session
   * started, not one presented at the door during it. It keeps the bundle's
   * true digest everywhere the digest is displayed, and stays out of the
   * de-duplication ledger: nobody uploaded these bytes this session, so an
   * upload of them is a first intake and must not be refused as a repeat of
   * a row the user never filed. `FIXTURE_DIGEST` in design.ts records the
   * same distinction for the hand-written seed orders.
   */
  seeded = false,
): DemoOrderRow {
  const fields = bundle.fields.map((f) => fieldOf(orderId, f));
  const byBundleId = new Map(bundle.fields.map((f, i) => [f.id, fields[i] as Field]));
  sinks.fields.push(...fields);

  // No countersign rows are filed here: a T1 field arrives queued, and the
  // ledger row for it opens with the first examiner's ruling (`t1RowFor`).
  // Until then g1 holds the release — there is nothing yet to second-read.
  sinks.countersign(orderId, []);

  demoPages[orderId] = {
    total: bundle.source.pages,
    pages: bundle.pages.map((p) => ({
      n: p.n,
      read_in_full: p.read_in_full,
      kind: p.kind,
      lines: [...p.lines],
      degraded: p.degraded,
      ...(p.image_url === null ? {} : { image_url: p.image_url }),
    })),
    instruments: bundle.instruments.map((i) => ({ ...i })),
  };

  const queued = fields.filter((f) => isOpen(f.state)).length;
  const open = queued > 0;
  const pkg = bundle.package;
  const row: DemoOrderRow = {
    id: orderId,
    order_ref: form.external_ref,
    client_id: form.client_id,
    jurisdiction: pkg.jurisdiction,
    state: pkg.state,
    county: pkg.county,
    status: "ingested",
    arrived_at: at,
    accepted_at: null,
    delivered_at: null,
    product: form.product,
    period: form.period,
    pages: bundle.source.pages,
    band: "mine",
    // `review`: the gate-passed stage whose projection reads extraction
    // done and the QC gate live (workspace.ts pipelineFor, GATE_PASSED_STAGES).
    stage: "review",
    queue_position: null,
    addr: pkg.situs,
    place: `${pkg.county} County · ${pkg.state}`,
    waited: null,
    waiting_on: open ? "Human QC gate" : "Release signature",
    state_label: null,
    stamp_label: `Read by ${bundle.engines.map((e) => e.id).join(", ")}`,
    stamp_tone: open ? "action" : "settled",
    mine: true,
    failed: false,
  };
  addCreatedOrder(row);

  const settled = fields.filter(
    (f) => f.state === "confirmed" || f.state === "corrected" || f.state === "escalated",
  ).length;
  const authored: OrderTimelineEvent[] = bundle.timeline.map((e) => ({ at, ...e }));
  demoTimelines[orderId] = [
    { at, kind: "arrived", label: "arrived", detail: `upload · ${pkg.jurisdiction}`, attend: false },
    ...(authored.length > 0
      ? authored
      : [
          { at, kind: "extracted", label: "extracted", detail: `${String(bundle.pipeline.pages_relevant)} relevant pages · ${String(bundle.engines.length)} engines`, attend: false },
          { at, kind: "review", label: `review ${String(settled)}/${String(settled + queued)}`, detail: `${String(queued)} fields queued`, attend: false },
        ]),
  ];

  hydratedById.set(orderId, { order_id: orderId, sha256: bundle.sha256, bundle, fields, byBundleId, pdf_header_ok: pdfHeaderByDigest.get(bundle.sha256) ?? null });
  if (!seeded) seenDigests.set(bundle.sha256, form.external_ref);
  digestByOrder.set(orderId, bundle.sha256);
  return row;
}

/** The accept act, on the row and the timeline — a real instant, a named signer. */
export function acceptHydratedOrder(orderId: string, actor: string, at: string): void {
  if (!hydratedById.has(orderId)) return;
  acceptCreatedOrder(orderId, at);
  const trail = demoTimelines[orderId] ?? [];
  trail.splice(1, 0, { at, kind: "accepted", label: "accepted", detail: `signed ${actor}`, attend: false });
  demoTimelines[orderId] = trail;
}

/**
 * Re-decide the row's stamp tone after a write: `settled` once no decision
 * is queued and no T1 ruling awaits its second read, `action` otherwise.
 * The write handlers call this; a released row is left to its seal.
 */
export function syncHydratedStamp(orderId: string, openCountersigns: number): void {
  const rec = hydratedById.get(orderId);
  const row = demoOrderRow(orderId);
  if (rec === undefined || row === undefined || row.stage === "delivered") return;
  const queued = rec.fields.filter((f) => isOpen(f.state)).length;
  overlayOrderRow(orderId, queued > 0 || openCountersigns > 0 ? STAMP_OPEN : STAMP_CLEARED);
}

// ---- the gateway, per bundle --------------------------------------------------------

/**
 * The quarantine verdicts for a known package: the optical rows and the
 * note pair are the bundle's, the step details are composed from its page
 * count, and `resolved` is null on a duplicate — an already-filed digest
 * binds no rulebook a second time.
 */
export function quarantineForBundle(
  bundle: Bundle,
  orderId: string | null,
  sha256: string,
  duplicate: string | null,
  pdfHeaderOk: boolean | null,
): QuarantineResponse {
  const pkg = bundle.package;
  const pages = bundle.source.pages;
  /*
   * Each step states what was actually done. No scanner runs in the mock, so
   * the antivirus row is a STAND-IN that says so — the same convention as the
   * release gates that do not exist yet. The structure row reports the one
   * check the gateway performs on the bytes: the %PDF header; the page count
   * is the OCR job's, and the row says so rather than claiming a parse.
   */
  const pdfStep: QuarantineResponse["steps"][number] =
    pdfHeaderOk === null
      ? { id: "pdf", label: "Real PDF structure", state: "passed", detail: `not re-checked on this read · ${String(pages)} pages per the OCR job` }
      : pdfHeaderOk
        ? { id: "pdf", label: "Real PDF structure", state: "passed", detail: `%PDF header present · ${String(pages)} pages per the OCR job` }
        : { id: "pdf", label: "Real PDF structure", state: "failed", detail: "no %PDF header — the upload is not a PDF" };
  return {
    order_id: orderId,
    sha256,
    duplicate_of: duplicate,
    steps: [
      { id: "av", label: "Antivirus scan", state: "passed", detail: "NOT PERFORMED — stand-in; no scanner runs in the mock" },
      pdfStep,
      duplicate === null
        ? { id: "sha", label: "De-duplication (SHA-256)", state: "passed", detail: "no prior intake with this digest" }
        : { id: "sha", label: "De-duplication (SHA-256)", state: "failed", detail: `duplicate package (sha256 match) — byte-identical to ${duplicate}` },
    ],
    optical: bundle.quarantine.optical.map((r) => ({ ...r })),
    resolved:
      duplicate === null
        ? {
            jurisdiction: pkg.jurisdiction,
            state: pkg.state,
            county: pkg.county,
            page_count_label: `${String(pages)} pages (raster verified)`,
            jurisdiction_label: `${pkg.county} County, ${pkg.state}`,
            note_title: bundle.quarantine.resolved_note_title,
            note_body: bundle.quarantine.resolved_note_body,
          }
        : null,
  };
}
