import { z } from "zod";
import { NaReason } from "./enums.js";

/**
 * Intake quarantine, templates, the typist's call-back sheet, and
 * jurisdiction rules.
 */

// ---- Intake: quarantine gateway + optical profile ---------------------------

export const QuarantineState = z.enum(["pending", "running", "passed", "failed"]);
export type QuarantineState = z.infer<typeof QuarantineState>;

export const QuarantineStep = z.object({
  id: z.string(),
  label: z.string(),
  state: QuarantineState,
  detail: z.string().nullable(),
});
export type QuarantineStep = z.infer<typeof QuarantineStep>;

/**
 * Thresholds stay server-owned. Each reading carries the server's verdict;
 * the client never compares a value against a floor.
 */
export const OpticalReading = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  ok: z.boolean(),
  note: z.string().nullable(),
});
export type OpticalReading = z.infer<typeof OpticalReading>;

/**
 * What the server read off the package once quarantine passed — jurisdiction
 * comes from the recorded clerk stamp, never hand-entered, so the values
 * arrive here rather than on `CreateOrderRequest`. The `*_label` members and
 * the note pair are finished sentences — the client captions nothing. Null
 * until every gateway step passes: an unread stamp resolves nothing.
 */
export const QuarantineResolved = z.object({
  jurisdiction: z.string(),
  state: z.string(),
  county: z.string(),
  /** The paired row's left cell, finished — "64 pages (raster verified)". */
  page_count_label: z.string(),
  /** The paired row's right cell, finished — "Clayton County, GA". */
  jurisdiction_label: z.string(),
  /** The green note once the rulebook binds, server-authored. */
  note_title: z.string(),
  note_body: z.string(),
});
export type QuarantineResolved = z.infer<typeof QuarantineResolved>;

/**
 * Served by `GET /api/orders/{id}/quarantine` and by
 * `POST /api/intake/quarantine` (multipart, the `package` file alone) — the
 * gateway that runs the moment a file is dropped, before any order exists.
 * `order_id` is null on that pre-order read.
 */
export const QuarantineResponse = z.object({
  order_id: z.string().nullable(),
  sha256: z.string(),
  duplicate_of: z.string().nullable(),
  steps: z.array(QuarantineStep),
  optical: z.array(OpticalReading),
  resolved: QuarantineResolved.nullable(),
});
export type QuarantineResponse = z.infer<typeof QuarantineResponse>;

// ---- Templates architect ----------------------------------------------------

/**
 * The Templates Architect surface: a catalog of client templates, a live
 * sheet per template, a per-block wording expression with its product
 * baseline, a four-state NA matrix, token palettes, and scoped sample
 * documents — each server-authored.
 */

/** The four declared absence strings a block must state (never collapsed). */
export const TemplateNaMatrix = z.object({
  structurally_absent: z.string(),
  not_found: z.string(),
  not_stated: z.string(),
  unreadable: z.string(),
});
export type TemplateNaMatrix = z.infer<typeof TemplateNaMatrix>;

/** A wording token and the sample value the live preview interpolates. */
export const TemplateToken = z.object({
  token: z.string(),
  sample: z.string(),
});
export type TemplateToken = z.infer<typeof TemplateToken>;

/** One labelled row of the live sheet, as the server rendered it. */
export const TemplateSheetRow = z.object({
  label: z.string(),
  value: z.string(),
  /** Identifier-register rows (order refs, parcel ids, instants) draw mono. */
  mono: z.boolean(),
});
export type TemplateSheetRow = z.infer<typeof TemplateSheetRow>;

export const TemplateSheetBlock = z.object({
  key: z.string(),
  title: z.string(),
  /** The product-lock chip ("Product Rule P-CO-1 · Structure Locked"). */
  lock_note: z.string(),
  rows: z.array(TemplateSheetRow),
  /** The client's sentence-format expression for this block. */
  wording: z.string(),
  /** The product baseline default the Split Diff compares against. */
  baseline: z.string(),
  tokens: z.array(TemplateToken),
  /** Null = this block declares no NA matrix (e.g. the locked header). */
  na_matrix: TemplateNaMatrix.nullable(),
  /** A state-overlay remark drawn on the block ("State Overlay R-GA-01: …"). */
  overlay_note: z.string().nullable(),
});
export type TemplateSheetBlock = z.infer<typeof TemplateSheetBlock>;

export const TemplateStatus = z.enum(["active", "draft"]);
export type TemplateStatus = z.infer<typeof TemplateStatus>;

/** One catalog card: name, client, product, status, mapped count, version. */
export const TemplateSummary = z.object({
  id: z.string(),
  name: z.string(),
  client: z.string(),
  product: z.string(),
  version: z.string(),
  status: TemplateStatus,
  mapped_fields: z.number().int(),
  total_fields: z.number().int(),
});
export type TemplateSummary = z.infer<typeof TemplateSummary>;

/**
 * `GET /api/templates` — the catalog, with the filter vocabularies the
 * rail's two selects offer. The vocabularies are served: a client list
 * spelled in a component is a list the contract never named.
 */
export const TemplateCatalogResponse = z.object({
  templates: z.array(TemplateSummary),
  clients: z.array(z.string()),
  products: z.array(z.string()),
});
export type TemplateCatalogResponse = z.infer<typeof TemplateCatalogResponse>;

/** A scoped client sample document, with the citation fields the inspector draws. */
export const TemplateSampleDoc = z.object({
  id: z.string(),
  name: z.string(),
  doc_id: z.string(),
  uploaded: z.string(),
  blocks_extracted: z.number().int(),
  notes: z.string(),
  snippet: z.string(),
  /** The recorded bounding box, verbatim ("[142, 320, 684, 410]"). */
  box: z.string(),
  page: z.number().int(),
});
export type TemplateSampleDoc = z.infer<typeof TemplateSampleDoc>;

/** `GET /api/templates/{id}` — one template, whole. */
export const TemplateDetailResponse = TemplateSummary.extend({
  blocks: z.array(TemplateSheetBlock),
  samples: z.array(TemplateSampleDoc),
  /** The audit tab's provenance rows. */
  sha256: z.string(),
  source_ref: z.string(),
  source_citation: z.string(),
  /** The compiled manifest the composer consumes, as the server emits it. */
  export_spec: z.string(),
});
export type TemplateDetailResponse = z.infer<typeof TemplateDetailResponse>;

/**
 * `PATCH /api/templates/{id}` — posts the edited wording per block key;
 * guarded by `template.edit`. The server answers with the saved draft's
 * version.
 */
export const TemplateSaveRequest = z.object({
  wording: z.record(z.string(), z.string()),
});
export type TemplateSaveRequest = z.infer<typeof TemplateSaveRequest>;

export const TemplateSaveResponse = z.object({
  id: z.string(),
  version: z.string(),
  saved_at: z.string(),
});
export type TemplateSaveResponse = z.infer<typeof TemplateSaveResponse>;

// ---- Typist capture: the Abstractor Call Back Sheet -------------------------

export const SheetField = z.object({
  path: z.string(),
  label: z.string(),
  /** Free text, money, date — drives the control, not a validator. */
  kind: z.enum(["text", "money", "date", "select"]),
  options: z.array(z.string()),
  required: z.boolean(),
});
export type SheetField = z.infer<typeof SheetField>;

export const SheetSection = z.object({
  id: z.string(),
  title: z.string(),
  fields: z.array(SheetField),
});
export type SheetSection = z.infer<typeof SheetSection>;

/**
 * `GET /api/blind/{order}/schedule` — what to key, in keying order. A
 * blind-side shape: no machine value, no confidence, no other seat's entry,
 * so a typist reading it learns nothing about the model's answer.
 */
export const CaptureScheduleResponse = z.object({
  order_id: z.string(),
  seat: z.string(),
  pages: z.number().int(),
  sections: z.array(SheetSection),
});
export type CaptureScheduleResponse = z.infer<typeof CaptureScheduleResponse>;

// ---- Jurisdiction rules -----------------------------------------------------

export const NullStateRow = z.object({
  path: z.string(),
  label: z.string(),
  reason: NaReason,
  renders_as: z.string(),
});
export type NullStateRow = z.infer<typeof NullStateRow>;

export const JurisdictionRule = z.object({
  id: z.string(),
  code: z.string(),
  text: z.string(),
  applies: z.boolean(),
  scope_note: z.string().nullable(),
});
export type JurisdictionRule = z.infer<typeof JurisdictionRule>;

export const JurisdictionResponse = z.object({
  code: z.string(),
  label: z.string(),
  baseline_note: z.string(),
  rules: z.array(JurisdictionRule),
  null_states: z.array(NullStateRow),
});
export type JurisdictionResponse = z.infer<typeof JurisdictionResponse>;

// ---- rail badges ------------------------------------------------------------

/**
 * `GET /api/rail` — the three door ornaments the rail draws. Each arrives
 * finished: `qc` is the pill's whole text ("1 QC"), not a number the client
 * captions, and `template_version` is quoted from the templates resource
 * rather than restated. A count of what sits, never a rate.
 */
export const RailBadgesResponse = z.object({
  /** The All Orders door's pill — the browse endpoint's own total. */
  orders_total: z.number().int(),
  /** The QC & Escalations badge, finished ("1 QC"). Null = no badge drawn. */
  qc: z.string().nullable(),
  /** The Templates Architect pill ("v4.2"), quoted from the templates mock. */
  template_version: z.string(),
});
export type RailBadgesResponse = z.infer<typeof RailBadgesResponse>;
