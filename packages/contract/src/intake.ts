import { z } from "zod";

/**
 * The per-order intake resources: sign-off, pipeline progress, the
 * completeness gate — plus the lifecycle census and the people roster.
 * Same rule as `workspace.ts`: read shapes only. Closing the gate is a
 * transition the server owns.
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
  /**
   * `answers` is what this line may be answered — served per line because the
   * set is a product rule, and a rule reconstructed in a browser is a second
   * rulebook. `policy_suggestion` names which answer policy proposed;
   * `prefilled_from_policy` says that it did. Both stay separate from
   * `answer`: policy may suggest, but the line is not signed until a person
   * answers it.
   */
  answers: z.array(SignoffAnswer),
  policy_suggestion: SignoffAnswer.nullable(),
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
  /**
   * The stage row's count chip ("38 pages → 6 recorded instruments"),
   * server-composed — never a numeral the client parses back out of
   * `detail`. Null = the server has no figure for this stage.
   */
  count: z.string().nullable(),
});
export type PipelineStage = z.infer<typeof PipelineStage>;

/**
 * One line of the run's log, as the dark terminal draws it: a mono
 * timestamp, the server's sentence, and two emphases (a warn register and a
 * bold line). Read shape only — nothing writes a log line.
 */
export const PipelineLogLine = z.object({
  time: z.string(),
  text: z.string(),
  warn: z.boolean(),
  strong: z.boolean(),
});
export type PipelineLogLine = z.infer<typeof PipelineLogLine>;

export const OrderPipelineResponse = z.object({
  order_id: z.string(),
  total_pages: z.number().int(),
  pages_relevant: z.number().int(),
  classifier_note: z.string(),
  /** Server state. The screen never infers a halt from a stage list. */
  gate_halted: z.boolean(),
  stages: z.array(PipelineStage),
  /**
   * All server-authored strings so the client composes nothing:
   * `package_name`/`volume_label` — the meta strip's cells; null = the server
   * has no package to name. `eta_label` — the "Time to examination" chip,
   * never a subtraction of timestamps in the browser. `run_log` — the
   * terminal's lines, in the server's order. `verified_checks` — sentences
   * only the pipeline can claim.
   */
  package_name: z.string().nullable(),
  volume_label: z.string().nullable(),
  eta_label: z.string(),
  run_log: z.array(PipelineLogLine),
  verified_checks: z.array(z.string()),
});
export type OrderPipelineResponse = z.infer<typeof OrderPipelineResponse>;

// ---- completeness gate -----------------------------------------------------

export const GapKind = z.enum(["na_provisional", "disagreement", "period_short"]);
export type GapKind = z.infer<typeof GapKind>;

/**
 * The server decides which close options it offers, their order, and whether
 * any may be taken; no write exists for them. `kind`, `requires_comment`,
 * and `min_role` are the facts ranking needs — inferring them from the label
 * copy would put a second, silently drifting rulebook in the browser.
 */
export const GapCloseKind = z.enum(["upload", "amend", "root_of_title", "change_product"]);
export type GapCloseKind = z.infer<typeof GapCloseKind>;

export const GapCloseOption = z.object({
  kind: GapCloseKind,
  label: z.string(),
  /** What choosing it does to the record, stated at the moment of choosing. */
  consequence: z.string(),
  requires_comment: z.boolean(),
  /** Null = anyone who can see the gate. Otherwise the role the server requires. */
  min_role: z.string().nullable(),
});
export type GapCloseOption = z.infer<typeof GapCloseOption>;

/**
 * A gap between what the sign-off claimed and what the package supports.
 * The gate blocks extraction: finding out after extraction that a package
 * cannot support the ordered search costs the extraction.
 */
export const CompletenessGap = z.object({
  id: z.string(),
  kind: GapKind,
  /**
   * The sign-off line this gap was raised against. Server-supplied rather
   * than looked up from the label: two lines may share wording across
   * product versions, and matching on prose is a join the browser has no
   * business making.
   */
  line_number: z.number().int(),
  line_label: z.string(),
  claim: z.string(),
  evidence: z.string(),
  /** Server-offered ways to close it. The screen never invents one. */
  close_options: z.array(GapCloseOption),
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
  /**
   * `id` is the join key — `order_ref` is a human reference no endpoint
   * takes. `mine` is whose work it is; `state_label` is the server's word
   * for why it stopped — deliberately not named `state` and not an enum, so
   * no client can switch on it and re-implement a server state machine.
   * Null when the order has not stopped.
   */
  id: z.string(),
  order_ref: z.string(),
  addr: z.string(),
  county: z.string(),
  waiting_on: z.string().nullable(),
  waited: z.string().nullable(),
  failed: z.boolean(),
  mine: z.boolean(),
  state_label: z.string().nullable(),
});
export type LifecycleOrder = z.infer<typeof LifecycleOrder>;

/**
 * `count` is server-supplied and is not `orders.length`: the order list is
 * scoped to what the caller may see, the census is not.
 */
export const LifecycleStage = z.object({
  id: z.string(),
  label: z.string(),
  /**
   * `sub` is what the stage is ("answering the lines"); `waiting_on` is who
   * it waits on ("abstractor"). Authored per stage on the server, not
   * derived from `kind` — four `kind` values cannot carry "who is holding
   * this".
   */
  sub: z.string(),
  waiting_on: z.string(),
  kind: StageKind,
  count: z.number().int(),
  orders: z.array(LifecycleOrder),
});
export type LifecycleStage = z.infer<typeof LifecycleStage>;

/**
 * One Overview stat card, whole: the figure, the note under it, and the
 * label over it are one server-authored statement. The label rides with the
 * figure because `delivered_recent`'s label names its window — a period only
 * the server can define. A census, never a rate: no per-hour, per-person, or
 * per-period figure may ever join it.
 */
export const LifecycleFigure = z.object({
  /** The card's caption. For `delivered_recent` it states the window too. */
  label: z.string(),
  value: z.number().int(),
  /** The design's third line — what this figure means, in the pipeline's words. */
  note: z.string(),
});
export type LifecycleFigure = z.infer<typeof LifecycleFigure>;

export const LifecycleResponse = z.object({
  scope_note: z.string(),
  total: z.number().int(),
  halted: z.number().int(),
  moving: z.number().int(),
  failed: z.number().int(),
  /**
   * The four stat-card figures, in the design's card order. `active` is one
   * server-side definition of "not delivered" instead of a browser
   * subtraction. `in_review` is a member rather than a `stages[id="review"]`
   * lookup because `LifecycleStage.id` is an incidental string, not a stable
   * contract value. `queries_and_gaps` is the shop's own bucket (gate +
   * escalated). `delivered_recent` is a windowed count, never a pace; its
   * label carries the window.
   */
  active: LifecycleFigure,
  in_review: LifecycleFigure,
  queries_and_gaps: LifecycleFigure,
  delivered_recent: LifecycleFigure,
  stages: z.array(LifecycleStage),
});
export type LifecycleResponse = z.infer<typeof LifecycleResponse>;

// ---- order context ---------------------------------------------------------

/**
 * `label` is the exact word the strip prints ("SIGN-OFF OPEN", "FINALIZED"),
 * server-chosen — deriving it in the browser would be a client-side
 * lifecycle state machine. A free string, deliberately not an enum: an enum
 * invites a `switch`, which is the same machine one line down. `tone` is the
 * only machine-readable axis and drives paint alone.
 */
export const LifecycleStamp = z.object({
  label: z.string(),
  tone: z.enum(["neutral", "action", "settled", "attend", "halt"]),
});
export type LifecycleStamp = z.infer<typeof LifecycleStamp>;

/**
 * One item of the rail stage rows or order-bar stage tabs; its state arrives
 * decided. `done`/`badge` are the server's word — the browser never derives
 * a check from a count reaching a total, and `badge` is the finished string
 * the pill prints ("6", "ready"), never a number the client formats.
 * `badge_tone` drives paint alone, exactly as `LifecycleStamp.tone` does.
 */
export const OrderStageTab = z.object({
  /** Stable stage id ("upload" | "processing" | "review" | "composer" | "delivered"). */
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
  badge: z.string().nullable(),
  badge_tone: z.enum(["attend", "settled"]),
});
export type OrderStageTab = z.infer<typeof OrderStageTab>;

export const OrderContextResponse = z.object({
  order_id: z.string(),
  order_ref: z.string(),
  product: z.string().nullable(),
  period_label: z.string().nullable(),
  pages: z.number().int().nullable(),
  stamp: LifecycleStamp,
  /*
   * The members the order bar, rail, and spotlight draw. All server-
   * authored, all nullable where an order can honestly not have one.
   */
  /** The finished place line the bar prints — "1856 Defoor Ave NW, Atlanta · Fulton County, GA". */
  place: z.string().nullable(),
  /** The CLIENT'S NAME, resolved server-side — `client_id` is a join key, not a word a reader reads. */
  client: z.string().nullable(),
  /** Who holds the order. Null while nobody has taken it. */
  assigned: z.string().nullable(),
  /**
   * The finished due label — "Due today · 5h 20m left". Served, never
   * computed: the string arrives whole and the client never runs a clock.
   */
  due: z.string().nullable(),
  /** Outstanding examination decisions — the census figure the Review (N) button prints. */
  outstanding: z.number().int().nullable(),
  /** The rail's five numbered stage rows, in order. */
  stage_nav: z.array(OrderStageTab),
  /** The order bar's five stage tabs, in order. */
  stage_tabs: z.array(OrderStageTab),
});
export type OrderContextResponse = z.infer<typeof OrderContextResponse>;

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
 * `privileged_without_mfa` is the server's figure, never a client filter
 * over `people`: the roster is role-scoped, the gate is not. A compliance
 * count that falls as permissions narrow looks satisfied when it is not.
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
 * Who you are — which `/api/me/permissions` deliberately does not answer;
 * that endpoint says what you may do. Identity and authorization are
 * different questions.
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
 * User preferences, server-side — the reason nothing in this app touches
 * localStorage. A preference that lives in one browser silently resets on
 * the machine somebody actually uses.
 */
export const Preferences = z.object({
  /**
   * Whether the screen menu is folded — or null, meaning the user has never
   * chosen and the route's own default governs. Three states are required:
   * folded, unfolded, never asked. Nullable rather than a companion boolean,
   * which could disagree with it; PATCH already distinguishes an absent key
   * from a sent one, so "never chosen" cannot be written back by accident.
   */
  nav_collapsed: z.boolean().nullable(),
  reduced_motion: z.boolean(),
  default_zoom: z.number(),
  /** Colour theme. Server-side for the same reason as every other preference here. */
  theme: z.enum(["titlepipe", "mocha"]).default("titlepipe"),
});
export type Preferences = z.infer<typeof Preferences>;

export const PreferencesResponse = z.object({ preferences: Preferences });
export type PreferencesResponse = z.infer<typeof PreferencesResponse>;

/** PATCH /api/me/preferences — every field optional; unsent fields are unchanged. */
export const UpdatePreferencesRequest = Preferences.partial();
export type UpdatePreferencesRequest = z.infer<typeof UpdatePreferencesRequest>;
