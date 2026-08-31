import { z } from "zod";

/**
 * The workspace layer — the config, admin, and intake resources the reviewer
 * flow reads but does not own. Read shapes only, deliberately: the writes
 * that would go with them (publish a grid, retire a line, resolve a
 * checklist) are state transitions the server owns, and are absent rather
 * than guessed at.
 */

// ---- products & sign-off config -------------------------------------------

/** How a product's period is derived. `y` is a fixed year count. */
export const Derivation = z.enum(["cos", "tos", "update", "y"]);
export type Derivation = z.infer<typeof Derivation>;

/** Whether a standard line applies to a product, and how. */
export const LineApplication = z.enum(["applies", "narrowed", "excluded"]);
export type LineApplication = z.infer<typeof LineApplication>;

export const ConfigProduct = z.object({
  id: z.string(),
  code: z.string(),
  full: z.string(),
  sub: z.string(),
  period: z.string(),
  derivation: Derivation,
  retired: z.boolean(),
});
export type ConfigProduct = z.infer<typeof ConfigProduct>;

/**
 * One of the standard sign-off lines. `machine_check` names what the pipeline
 * can verify the answer against — `null` means nothing can, which is the
 * interesting case: the line rests entirely on the abstractor's word.
 */
export const ConfigLine = z.object({
  id: z.string(),
  n: z.number().int(),
  label: z.string(),
  group: z.string(),
  answers: z.array(z.string()),
  comment_on_no: z.boolean(),
  period_scoped: z.boolean(),
  machine_check: z.string().nullable(),
  standard_text: z.string().nullable(),
  version: z.number().int(),
  retired: z.boolean(),
  /** product id → how this line applies to that product. */
  cells: z.record(z.string(), LineApplication),
  /** product id → narrowing text, where the cell is `narrowed`. */
  scope: z.record(z.string(), z.string()),
});
export type ConfigLine = z.infer<typeof ConfigLine>;

export const ConfigResponse = z.object({
  config_version: z.string(),
  frozen: z.boolean(),
  products: z.array(ConfigProduct),
  lines: z.array(ConfigLine),
});
export type ConfigResponse = z.infer<typeof ConfigResponse>;

// ---- clients & overrides ---------------------------------------------------

export const OverrideType = z.enum(["waive", "narrow", "replace", "add"]);
export type OverrideType = z.infer<typeof OverrideType>;

export const ClientOverride = z.object({
  id: z.string(),
  type: OverrideType,
  line_id: z.string().nullable(),
  description: z.string(),
  note: z.string(),
  authored_by: z.string(),
  authored_at: z.string(),
});
export type ClientOverride = z.infer<typeof ClientOverride>;

export const ClientRecord = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  product_ids: z.array(z.string()),
  signoff_defaults: z.record(z.string(), z.string()),
  overrides: z.array(ClientOverride),
  /**
   * The finished label ("12 sign-offs") — the server's census of the
   * client's effective checklist, never a browser tally over `effective`.
   * Optional: absent is "the server did not say".
   */
  sign_offs: z.string().optional(),
});
export type ClientRecord = z.infer<typeof ClientRecord>;

/**
 * The resolved checklist for one client against one product. Resolution is
 * server work — never recomputed by a screen from the baseline plus the
 * override list; two resolvers disagreeing is exactly the defect that ships
 * a search missing a line somebody thought was covered.
 */
export const EffectiveLine = z.object({
  line_id: z.string(),
  n: z.number().int(),
  label: z.string(),
  application: LineApplication,
  /** Which override, if any, moved this line off the baseline. */
  override_id: z.string().nullable(),
  scope_note: z.string().nullable(),
});
export type EffectiveLine = z.infer<typeof EffectiveLine>;

export const EffectiveChecklist = z.object({
  client_id: z.string(),
  product_id: z.string(),
  lines: z.array(EffectiveLine),
  /** Server-detected contradiction between two overrides. */
  conflict: z.string().nullable(),
  conflict_acknowledged: z.boolean(),
});
export type EffectiveChecklist = z.infer<typeof EffectiveChecklist>;

export const ClientsResponse = z.object({
  clients: z.array(ClientRecord),
  effective: z.array(EffectiveChecklist),
});
export type ClientsResponse = z.infer<typeof ClientsResponse>;
