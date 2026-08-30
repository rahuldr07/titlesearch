import { z } from "zod";
import { NaReason } from "./enums.js";

/**
 * Second half of the surface added under the 2026-08-28 ruling: intake
 * quarantine, templates, the typist's call-back sheet, and jurisdiction rules.
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
 * Thresholds stay SERVER-OWNED. Each reading carries the server's verdict; the
 * client never compares a value against a floor.
 */
export const OpticalReading = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  ok: z.boolean(),
  note: z.string().nullable(),
});
export type OpticalReading = z.infer<typeof OpticalReading>;

export const QuarantineResponse = z.object({
  order_id: z.string(),
  sha256: z.string(),
  duplicate_of: z.string().nullable(),
  steps: z.array(QuarantineStep),
  optical: z.array(OpticalReading),
});
export type QuarantineResponse = z.infer<typeof QuarantineResponse>;

// ---- Templates architect ----------------------------------------------------

export const TemplateBlock = z.object({
  id: z.string(),
  numeral: z.string(),
  title: z.string(),
  /** Which report shape includes it, per the server. */
  included: z.boolean(),
  note: z.string(),
});
export type TemplateBlock = z.infer<typeof TemplateBlock>;

export const TemplateSample = z.object({
  client_id: z.string(),
  client: z.string(),
  shape: z.string(),
  lines: z.number().int(),
});
export type TemplateSample = z.infer<typeof TemplateSample>;

export const TemplateResponse = z.object({
  version: z.string(),
  blocks: z.array(TemplateBlock),
  samples: z.array(TemplateSample),
  /** The compiled manifest the composer consumes, as the server emits it. */
  export_spec: z.string(),
});
export type TemplateResponse = z.infer<typeof TemplateResponse>;

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
 * `GET /api/blind/{order}/schedule` — what to key, in keying order.
 *
 * A BLIND-SIDE shape: it carries no machine value, no confidence and no other
 * seat's entry, so a typist reading it learns nothing about the model's answer.
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
 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`:
 * "counts on rail doors, stage badges … are drawn, so they are built."
 *
 * `GET /api/rail` — the three door ornaments the reference app's rail draws.
 * Each arrives FINISHED: `qc` is the pill's whole text ("1 QC"), not a number
 * the client captions, and `template_version` is quoted from the templates
 * resource rather than restated. A count of what sits, never a rate.
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
