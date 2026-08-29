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
  /**
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * READ FIELDS ONLY. Neither adds a transition; the sign-off still has no
   * submit (ruling Q13) and nothing here lets a client decide an answer.
   *
   * `answers` is what THIS line may be answered. Six of the product's thirteen
   * admit N/A and seven do not, so a screen that offered all three everywhere
   * would be inviting an answer the sign-off cannot record. It is served per
   * line rather than derived from a group or a number, because the set is a
   * product rule and a rule reconstructed in a browser is a second rulebook.
   *
   * `policy_suggestion` names WHICH answer policy proposed. It was expressible
   * only as the boolean `prefilled_from_policy`, so the screen knew a
   * suggestion existed and genuinely could not say what it was. Both stay:
   * `prefilled_from_policy` says THAT policy suggested, `policy_suggestion`
   * says WHAT — and both stay separate from `answer`, because ruling Q13 turns
   * on exactly that distinction. Policy may suggest; the line is not SIGNED
   * until a person answers it, and a suggestion written into `answer` erases
   * the difference between a claim and a default.
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
 * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
 * A READ SHAPE ONLY: the server still decides which options it offers, the
 * order it offers them in, and whether any of them may be taken. No write
 * exists for a single one of them, and none is added here.
 *
 * They were opaque strings. A screen handed `"Change the product ordered"` and
 * `"Upload the missing pages"` cannot tell an option that ADDS EVIDENCE from
 * one that REWRITES A SIGNED ASSERTION from one that MOVES MONEY — so it
 * compensated by demanding a reason for all of them and ranking none.
 * `kind`, `requires_comment` and `min_role` are the three facts that ranking
 * needs, and inferring any of them from the copy would have put a second,
 * silently drifting rulebook in the browser.
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
 *
 * THE GATE BLOCKS EXTRACTION. That is the whole point of it: a package that
 * cannot support the search that was ordered produces a report nobody can
 * stand behind, and finding that out after extraction costs the extraction.
 */
export const CompletenessGap = z.object({
  id: z.string(),
  kind: GapKind,
  /**
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * A READ FIELD. The sign-off line this gap was raised against. The card's own
   * heading is "Sign-off line N · label" and N was not on the wire, so the
   * screen printed the label alone and the reader could not get back to the
   * line they answered. Server-supplied rather than looked up from the label:
   * two lines may share wording across product versions, and matching on prose
   * is a join the browser has no business making.
   */
  line_number: z.number().int(),
  line_label: z.string(),
  claim: z.string(),
  evidence: z.string(),
  /**
   * Server-offered ways to close it. The screen never invents one.
   *
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * WIDENED FROM `z.array(z.string())` — see `GapCloseOption` above for why an
   * opaque string could not be ranked, and why guessing the ranking from the
   * copy would have been a client-side rulebook.
   */
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
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * READ FIELDS ONLY.
   *
   * `id` is the join the census never had. A board card names an order and
   * cannot open it, because `order_ref` is a human reference and no endpoint
   * takes one; `OrderStrip.tsx` records the same gap from the other side. A
   * card that names work nobody can reach is a dead end.
   *
   * `mine` and `state_label` are the two facts the board draws that could
   * otherwise only be guessed: whose work it is, and the SERVER'S WORD for why
   * it stopped. `state_label` is a label and nothing else — deliberately not
   * named `state`, and deliberately not an enum, so that no client can switch
   * on it and re-implement a state machine hard rule 3 puts on the server.
   * Null when the order has not stopped and there is nothing to say.
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
 * `count` is SERVER-SUPPLIED and is not `orders.length`. The order list is
 * scoped to what the caller may see; the census is not. A stage count that
 * shrank with your permissions would read as work disappearing rather than as
 * work you cannot look at.
 */
export const LifecycleStage = z.object({
  id: z.string(),
  label: z.string(),
  /**
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * READ FIELDS ONLY. `sub` is what the stage IS ("answering the lines");
   * `waiting_on` is who it waits on ("abstractor"). The board drew a column
   * header with neither, so an empty stage said nothing at all about itself —
   * and an empty column is exactly when a reader most needs to be told what
   * would be sitting there.
   *
   * Authored per stage on the server, not derived from `kind`: "who is holding
   * this" is an operational fact about the shop, and four `kind` values cannot
   * carry it.
   */
  sub: z.string(),
  waiting_on: z.string(),
  kind: StageKind,
  count: z.number().int(),
  orders: z.array(LifecycleOrder),
});
export type LifecycleStage = z.infer<typeof LifecycleStage>;

/**
 * ⚠ RULED 2026-08-28 — `docs/frontend/design-2026-08/RULING-2026-08-28.md`,
 * resolving `CONFLICT-overview-stats.md` by its Option A: "`LifecycleResponse`
 * gains the members the four named cards need." READ FIELDS ONLY.
 *
 * One Overview stat card, WHOLE: the figure, the note under it, and the label
 * over it are one server-authored statement. The note exists on the wire for
 * the reason `QueueBand.note` and `LifecycleStage.sub` do — "a client-side
 * `Record<…, string>` is a second copy of product copy that drifts silently
 * from the first" (endpoints.ts:96-98) — and the label rides with it because
 * `delivered_recent`'s label NAMES ITS WINDOW ("Delivered This Week" is a
 * period only the server can define; printing a window the client chose would
 * be the caption defect one layer down). A CENSUS, NEVER A RATE (§4.5): each
 * is a count of what sits or was delivered, and no per-hour, per-person or
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
   * The four Option-A figures, in the design's card order.
   *
   * `active` is one server-side definition of "not delivered" instead of a
   * browser subtraction. `in_review` is a MEMBER rather than a
   * `stages[id="review"]` lookup because `LifecycleStage.id` is an incidental
   * string, not a stable contract value (CONFLICT-overview-stats §4) — a
   * headline that vanishes when the shop renames a stage is the fragility the
   * census exists to prevent. `queries_and_gaps` is the shop's own bucket
   * (gate + escalated — the same bucket `OrderFilter` "waiting" names).
   * `delivered_recent` is a windowed COUNT of what was delivered, never a
   * pace; its label carries the window.
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
 * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
 * A READ SHAPE ONLY, and the whole point of it is that it is SERVER-DECIDED.
 *
 * `label` is the exact word the strip prints — `SIGN-OFF OPEN`,
 * `DECISIONS OPEN`, `PACKAGE INCOMPLETE`, `FINALIZED`. The 2026-07-28 export
 * computes that word from a five-branch `if/else` in the browser over
 * `allSignoff` / `compOpen` / `allAnswered` / the current screen
 * (`TitlePipe.dc.html:2888-2893`). That is a client-side lifecycle state
 * machine and hard rule 3 forbids it, so the word arrives already chosen.
 *
 * `label` is a FREE STRING, not an enum, and that is deliberate. An enum is an
 * invitation to `switch` on it, and a `switch` on a lifecycle word is the same
 * state machine moved one line down. `tone` is the only machine-readable axis
 * — it drives `Stamp`'s five variants and nothing else. A client that wants to
 * know whether the order is finished asks a field that says so, not the stamp.
 */
export const LifecycleStamp = z.object({
  label: z.string(),
  tone: z.enum(["neutral", "action", "settled", "attend", "halt"]),
});
export type LifecycleStamp = z.infer<typeof LifecycleStamp>;

/**
 * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
 * GET /api/orders/{id}/context — READ ONLY.
 *
 * The order-scoped lookup the top strip needs and that no endpoint offered.
 * Every screen below `/orders/{id}` has the URL id and nothing else:
 * `LifecycleOrder.order_ref` lives in the census list and (until this wave)
 * carried no id to join back on, and `Order.external_ref` arrives only from
 * `/api/queue/next`, which is a hand-over and not a lookup. `OrderStrip.tsx`
 * records the consequence in its own CONTRACT GAP note — it printed the opaque
 * `ord_demo_1` where the design says `ORDER 4176034-1`.
 *
 * `product` / `period_label` / `pages` ride here as well as on `Order` because
 * this is the endpoint an order-scoped screen can actually reach; the delivered
 * screen carried all three as private constants for want of it, and a delivery
 * confirmation that cannot name what was delivered is confirming an unnamed
 * thing. Nullable throughout: an order that failed validation has no resolved
 * product and an unreadable package has no page count. `null` is that
 * statement — `0` would be a count, and a count is a claim.
 */
export const OrderContextResponse = z.object({
  order_id: z.string(),
  order_ref: z.string(),
  product: z.string().nullable(),
  period_label: z.string().nullable(),
  pages: z.number().int().nullable(),
  stamp: LifecycleStamp,
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
  /**
   * Whether the screen menu is folded to its compact form — or NULL, meaning
   * the user has never chosen and the route's own default governs.
   *
   * ⚠ UI-DRIVEN REQUEST — AWAITING RATIFICATION (2026-07-30, fidelity Wave 2).
   * A READ SHAPE WIDENING; no new behaviour and no new endpoint. A plain
   * boolean cannot say "untouched": a stored `false` resolved and immediately
   * beat the route default, so "Review starts collapsed, and an explicit toggle
   * wins from then on" (the export's own comment,
   * `TitlePipe.dc.html:2897-2900`) was unreachable however the sidebar was
   * written. Two rules need three states — folded, unfolded, never asked.
   *
   * NULLABLE RATHER THAN A COMPANION `nav_collapsed_set: boolean`. A second
   * field can disagree with the first — `{ nav_collapsed: true,
   * nav_collapsed_set: false }` is representable and means nothing — and every
   * reader would then have to check two fields in the right order to learn one
   * thing. Nullability makes the unrepresentable state unrepresentable, and
   * `PATCH` already distinguishes an absent key from a sent one, so "never
   * chosen" cannot be written back by accident.
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
