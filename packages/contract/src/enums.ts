import { z } from "zod";

/**
 * Field lifecycle. The server owns every transition and threshold; the UI
 * renders `state` verbatim and never computes it from `engine_confidence_raw`,
 * `value === null`, or anything else.
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
 * The four no-value states. They describe the document and route differently;
 * never collapse them:
 *
 * - NOT_PRESENT — structurally absent in this jurisdiction. Correct, never
 *   surfaced for review.
 * - NOT_FOUND — the field exists here and was searched; nothing of record.
 *   Always surfaced.
 * - NOT_STATED — a document came back but is silent on the field.
 * - PRESENT_UNREADABLE — on the page but unreadable (degraded scan). Always
 *   surfaced; the only member that carries a page reference.
 *
 * A null `value` with a null `na_reason` means "not yet extracted" — a
 * pipeline state, not a member here. Never key anything off `value === null`.
 * Python models call NOT_PRESENT `NOT_USED_IN_JURISDICTION`; reconcile at the
 * backend port, not by renaming here.
 */
export const NaReason = z.enum([
  "NOT_PRESENT",
  "NOT_FOUND",
  "NOT_STATED",
  "PRESENT_UNREADABLE",
]);
export type NaReason = z.infer<typeof NaReason>;

/**
 * Typist confidence. "Unclear with source" is legitimate; a confident guess
 * is the poison.
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

/** Rule provenance tags. OPEN means do not build past it. */
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
 * Order status vocabulary is OPEN until the Flask models (the source of
 * truth) are ported. Do not invent a closed enum here.
 */
export const OrderStatus = z.string();
export type OrderStatus = z.infer<typeof OrderStatus>;

/**
 * Closed set: the four steps of the transmission sequence (signed, digest
 * recorded, transmitted, acknowledged) plus a reissue draft transmitted to
 * nobody and a transit failure (retryable, never a quality state — see
 * `Delivery`). The backend port reconciles against these members.
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
