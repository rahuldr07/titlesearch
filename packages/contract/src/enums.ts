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
 * The two NA states (CONTEXT §11). They render identically and route oppositely:
 * - NOT_PRESENT — structurally absent in this jurisdiction (San Diego BOOK/PAGE,
 *   Houston INST#). Correct. Never surfaced for review.
 * - PRESENT_UNREADABLE — the field exists on a degraded scan and could not be
 *   read. Honest answer. Always surfaced.
 * A null `value` with null `na_reason` means "not yet extracted", not NA.
 * Collapsing these states is the ghost-chasing bug — do not key anything off null.
 */
export const NaReason = z.enum(["NOT_PRESENT", "PRESENT_UNREADABLE"]);
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
 * Order/delivery status vocabularies are OPEN until the Flask models are ported
 * (P1) — they are the source of truth. Do not invent closed enums here.
 */
export const OrderStatus = z.string();
export type OrderStatus = z.infer<typeof OrderStatus>;
export const DeliveryStatus = z.string();
export type DeliveryStatus = z.infer<typeof DeliveryStatus>;
