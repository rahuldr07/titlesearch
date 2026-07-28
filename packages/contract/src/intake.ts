import { z } from "zod";

/**
 * The per-order intake resources: sign-off, pipeline progress, the
 * completeness gate — plus the lifecycle census and the people roster.
 *
 * Same rule as `workspace.ts`: READ SHAPES ONLY. What an order's gate says is
 * data; closing the gate is a transition the server owns, and rulings Q4–Q10
 * have not settled what it means. The screens render these and refuse to
 * pretend they can write them.
 */

// ---- abstractor sign-off ---------------------------------------------------

export const SignoffAnswer = z.enum(["YES", "NO", "N/A"]);
export type SignoffAnswer = z.infer<typeof SignoffAnswer>;

/**
 * One answered line. A NO carries its comment because a NO becomes a
 * disclosure the reviewer must later accept or escalate, and a disclosure
 * nobody wrote a reason for cannot be judged by the person who inherits it.
 *
 * `prefilled_from_policy` is the honest half of ruling Q13: policy may suggest
 * an answer, but the line is not SIGNED until a person answers it. The two
 * states must stay distinguishable on the wire or the screen cannot tell a
 * claim from a default.
 */
export const OrderSignoffLine = z.object({
  line_id: z.string(),
  n: z.number().int(),
  label: z.string(),
  group: z.string(),
  answer: SignoffAnswer.nullable(),
  comment: z.string().nullable(),
  comment_required: z.boolean(),
  machine_check: z.string().nullable(),
  period_scoped: z.boolean(),
  prefilled_from_policy: z.boolean(),
});
export type OrderSignoffLine = z.infer<typeof OrderSignoffLine>;

export const OrderSignoffResponse = z.object({
  order_id: z.string(),
  /** Null until a person signs. Policy prefill never fills this in. */
  signed_by: z.string().nullable(),
  signed_at: z.string().nullable(),
  product_name: z.string(),
  period_label: z.string(),
  lines: z.array(OrderSignoffLine),
});
export type OrderSignoffResponse = z.infer<typeof OrderSignoffResponse>;

// ---- pipeline progress -----------------------------------------------------

export const StagePhase = z.enum(["done", "running", "halted", "waiting"]);
export type StagePhase = z.infer<typeof StagePhase>;

export const StageOwner = z.enum(["Automated", "LLM agent", "You"]);
export type StageOwner = z.infer<typeof StageOwner>;

export const PipelineStage = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string(),
  owner: StageOwner,
  phase: StagePhase,
});
export type PipelineStage = z.infer<typeof PipelineStage>;

export const OrderPipelineResponse = z.object({
  order_id: z.string(),
  total_pages: z.number().int(),
  pages_relevant: z.number().int(),
  classifier_note: z.string(),
  /** Server state. The screen never infers a halt from a stage list. */
  gate_halted: z.boolean(),
  stages: z.array(PipelineStage),
});
export type OrderPipelineResponse = z.infer<typeof OrderPipelineResponse>;

// ---- completeness gate -----------------------------------------------------

export const GapKind = z.enum(["na_provisional", "disagreement", "period_short"]);
export type GapKind = z.infer<typeof GapKind>;

/**
 * A gap between what the sign-off claimed and what the package supports.
 *
 * THE GATE BLOCKS EXTRACTION. That is the whole point of it: a package that
 * cannot support the search that was ordered produces a report nobody can
 * stand behind, and finding that out after extraction costs the extraction.
 */
export const CompletenessGap = z.object({
  id: z.string(),
  kind: GapKind,
  line_label: z.string(),
  claim: z.string(),
  evidence: z.string(),
  /** Server-offered ways to close it. The screen never invents one. */
  close_options: z.array(z.string()),
  closed_by: z.string().nullable(),
  closed_note: z.string().nullable(),
});
export type CompletenessGap = z.infer<typeof CompletenessGap>;

export const OrderCompletenessResponse = z.object({
  order_id: z.string(),
  /** Server-owned. Never derived client-side from the gap list. */
  gate_open: z.boolean(),
  product_name: z.string(),
  period_label: z.string(),
  gaps: z.array(CompletenessGap),
});
export type OrderCompletenessResponse = z.infer<typeof OrderCompletenessResponse>;

// ---- lifecycle census ------------------------------------------------------

export const StageKind = z.enum(["idle", "halt", "machine", "done"]);
export type StageKind = z.infer<typeof StageKind>;

export const LifecycleOrder = z.object({
  order_ref: z.string(),
  addr: z.string(),
  county: z.string(),
  waiting_on: z.string().nullable(),
  waited: z.string().nullable(),
  failed: z.boolean(),
});
export type LifecycleOrder = z.infer<typeof LifecycleOrder>;

/**
 * `count` is SERVER-SUPPLIED and is not `orders.length`. The order list is
 * scoped to what the caller may see; the census is not. A stage count that
 * shrank with your permissions would read as work disappearing rather than as
 * work you cannot look at.
 */
export const LifecycleStage = z.object({
  id: z.string(),
  label: z.string(),
  kind: StageKind,
  count: z.number().int(),
  orders: z.array(LifecycleOrder),
});
export type LifecycleStage = z.infer<typeof LifecycleStage>;

export const LifecycleResponse = z.object({
  scope_note: z.string(),
  total: z.number().int(),
  halted: z.number().int(),
  moving: z.number().int(),
  failed: z.number().int(),
  stages: z.array(LifecycleStage),
});
export type LifecycleResponse = z.infer<typeof LifecycleResponse>;

// ---- people ----------------------------------------------------------------

export const AccountStatus = z.enum(["Active", "Suspended", "Invited"]);
export type AccountStatus = z.infer<typeof AccountStatus>;

export const MfaState = z.enum(["enrolled", "pending", "absent"]);
export type MfaState = z.infer<typeof MfaState>;

export const Person = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  privileged: z.boolean(),
  status: AccountStatus,
  mfa: MfaState,
});
export type Person = z.infer<typeof Person>;

/**
 * `privileged_without_mfa` is the SERVER'S figure, never a client filter over
 * `people`. The roster is role-scoped; the gate is not. A compliance count that
 * falls as your permissions narrow is a gate that looks satisfied when it is
 * not. Whether it BLOCKS is ruling Q16 and is not settled here.
 */
export const PeopleResponse = z.object({
  people: z.array(Person),
  privileged_without_mfa: z.number().int(),
});
export type PeopleResponse = z.infer<typeof PeopleResponse>;

// ---- me: profile & preferences ---------------------------------------------

export const SessionRecord = z.object({
  id: z.string(),
  device: z.string(),
  where: z.string(),
  last_seen: z.string(),
  current: z.boolean(),
});
export type SessionRecord = z.infer<typeof SessionRecord>;

/**
 * WHO you are, which `/api/me/permissions` deliberately does not answer — that
 * endpoint says what you may do. Identity and authorisation are different
 * questions and conflating them is how a screen ends up trusting a name it got
 * from a permissions payload.
 */
export const MeProfileResponse = z.object({
  name: z.string(),
  email: z.string(),
  role: z.string(),
  /** Held by the identity provider; reported here, never set here. */
  mfa: MfaState,
  sessions: z.array(SessionRecord),
});
export type MeProfileResponse = z.infer<typeof MeProfileResponse>;

/**
 * User preferences, SERVER-SIDE — decision C16, and the reason nothing in this
 * app touches localStorage. A preference that lives in one browser is a
 * preference that silently resets on the machine somebody actually uses, and
 * §9.11 forbids browser storage outright.
 */
export const Preferences = z.object({
  /** Whether the screen menu is folded to its compact form. */
  nav_collapsed: z.boolean(),
  reduced_motion: z.boolean(),
  default_zoom: z.number(),
});
export type Preferences = z.infer<typeof Preferences>;

export const PreferencesResponse = z.object({ preferences: Preferences });
export type PreferencesResponse = z.infer<typeof PreferencesResponse>;

/** PATCH /api/me/preferences — every field optional; unsent fields are unchanged. */
export const UpdatePreferencesRequest = Preferences.partial();
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequest>;
