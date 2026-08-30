import { z } from "zod";

/**
 * Five-state field lifecycle. The SERVER owns every transition and every
 * threshold (CONTEXT §7). The UI renders `state` verbatim — it must never
 * compute it from `engine_confidence_raw`, from `value === null`, or from
 * anything else.
 */
export const FieldState = z.enum([
  "pending",
  "auto_confirmed",
  "needs_review",
  "confirmed",
  "corrected",
  "escalated",
]);
export type FieldState = z.infer<typeof FieldState>;

/**
 * The FOUR no-value states. Ratified by the owner 2026-07-26 (docs/frontend/
 * open-rulings.md Q1), widening this enum from the previous two.
 *
 * Three independent sources converged on four: CONTEXT §11 + HANDOFF §2 (which
 * said outright that the taxonomy "needs a ruling"), the Python `models.py`
 * trio, and the design in design-mock/ — which draws all four distinctly and
 * carries a States Gallery card reading "They must never collapse into one
 * grey dash."
 *
 * They are statements about the DOCUMENT, and they route differently:
 *
 * - NOT_PRESENT — structurally absent in this jurisdiction (San Diego
 *   BOOK/PAGE, Houston INST#, Greene BUILDING). Correct, and NEVER surfaced
 *   for review. Surfacing it sends reviewers chasing ghosts on every
 *   California order.
 * - NOT_FOUND — the field exists in this jurisdiction and was searched for,
 *   and there is nothing of record (McIntosh CONS, Mecklenburg PLAINTIFF
 *   ATTORNEY). Always surfaced.
 * - NOT_STATED — the document is silent on it. Distinct from NOT_FOUND: the
 *   search happened and returned a document; the document does not say.
 * - PRESENT_UNREADABLE — it is on the page and could not be read (degraded
 *   scan, microfilm density loss). The honest answer. Always surfaced, and
 *   the only member that carries a page reference.
 *
 * A null `value` with a null `na_reason` is "NOT YET EXTRACTED" — a fifth,
 * distinct render, and NOT a member here. It is a statement about the
 * PIPELINE, not the document. Never collapse it into an NA state, and never
 * key anything off `value === null`.
 *
 * Backend mapping note: Python `models.py` calls NOT_PRESENT
 * `NOT_USED_IN_JURISDICTION`. Same concept; reconcile at the Gate 6 port
 * rather than renaming here, which would churn the surviving screens.
 */
export const NaReason = z.enum([
  "NOT_PRESENT",
  "NOT_FOUND",
  "NOT_STATED",
  "PRESENT_UNREADABLE",
]);
export type NaReason = z.infer<typeof NaReason>;

/**
 * Typist three-part contract confidence (HANDOFF §4). "unclear with source" is
 * legitimate; a confident guess is the poison.
 */
export const BlindConfidence = z.enum(["certain", "probable", "unclear"]);
export type BlindConfidence = z.infer<typeof BlindConfidence>;

/** Seat label only — a typist's name never appears in blind-fifty data or UI. */
export const TypistSeat = z.enum(["A", "B"]);
export type TypistSeat = z.infer<typeof TypistSeat>;

export const RuleStatus = z.enum(["live", "pending", "retired"]);
export type RuleStatus = z.infer<typeof RuleStatus>;

export const RuleOrigin = z.enum([
  "spec",
  "escalation",
  "reconciliation",
  "complaint",
  "senior",
]);
export type RuleOrigin = z.infer<typeof RuleOrigin>;

/** Rule provenance tags (CONTEXT §9). OPEN means do not build past it. */
export const RuleProvenance = z.enum(["RULED", "DERIVED", "OPEN", "CONFLICT"]);
export type RuleProvenance = z.infer<typeof RuleProvenance>;

export const GoldenTag = z.enum(["delivered_report", "ruled", "suspect", "agreed"]);
export type GoldenTag = z.infer<typeof GoldenTag>;

export const EngineKind = z.enum(["vlm_image", "ocr_text", "hybrid"]);
export type EngineKind = z.infer<typeof EngineKind>;

/**
 * Complaint triage axis. `auto_confirmed` = no human saw it = the threshold is
 * wrong, not a reviewer. This grouping is the point of the complaints screen.
 */
export const HowItGotThrough = z.enum(["auto_confirmed", "human_confirmed"]);
export type HowItGotThrough = z.infer<typeof HowItGotThrough>;

/** R13 judgment enforceability. `unknown` routes to needs_review — never assume. */
export const JudgmentStatus = z.enum([
  "active",
  "satisfied",
  "released",
  "canceled",
  "vacated",
  "unknown",
]);
export type JudgmentStatus = z.infer<typeof JudgmentStatus>;

/**
 * Order status vocabulary is OPEN until the Flask models are ported (P1) — it
 * is the source of truth. Do not invent a closed enum here.
 */
export const OrderStatus = z.string();
export type OrderStatus = z.infer<typeof OrderStatus>;

/**
 * ⚠ RULED 2026-08-29 — `docs/frontend/design-2026-08/RULING-2026-08-29.md`.
 * Closed under the ruling: the reference app's Transmission Receipt draws a
 * delivery as a four-step act — signed, digest recorded, transmitted,
 * acknowledged — so the status vocabulary is the four terminal points of that
 * sequence plus the two states the fixtures already carried: a reissue DRAFT
 * that has been transmitted to nobody, and a transit failure (retryable,
 * never a quality state — see `Delivery`).
 *
 * The pre-ruling `z.string()` was marked OPEN pending the Flask port; the
 * ruling resolves it for the reference: the mocks serve these members and the
 * Gate 6 port reconciles against them rather than the other way round.
 */
export const DeliveryStatus = z.enum([
  "draft",
  "signed",
  "digest_recorded",
  "transmitted",
  "acknowledged",
  "failed_transit",
]);
export type DeliveryStatus = z.infer<typeof DeliveryStatus>;
