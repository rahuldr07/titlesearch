import type { LifecycleResponse } from "@titlepipe/contract";

/**
 * THE OVERVIEW'S FOUR STAT CARDS, NAMED ONCE — the Option-A figures of
 * `LifecycleResponse` (RULING-2026-08-28, resolving CONFLICT-overview-stats).
 * The label, value and note all arrive ON the figure, server-authored; what
 * this table holds is the only part that is legitimately presentation — which
 * member each card binds to, in the design's order, and the two tones the
 * reference draws it in (`reference-app.html` `queueStats`: values ink /
 * graphite / amber / green, notes muted except the last two, which take the
 * figure's own state colour).
 */
export type CensusTone = "primary" | "secondary" | "attend" | "settled";
export type CensusNoteTone = "muted" | "attend" | "settled";

export type CensusFigure = {
  readonly member: keyof Pick<
    LifecycleResponse,
    "active" | "in_review" | "queries_and_gaps" | "delivered_recent"
  >;
  readonly tone: CensusTone;
  readonly noteTone: CensusNoteTone;
};

export const CENSUS_FIGURES: readonly CensusFigure[] = [
  { member: "active", tone: "primary", noteTone: "muted" },
  { member: "in_review", tone: "secondary", noteTone: "muted" },
  { member: "queries_and_gaps", tone: "attend", noteTone: "attend" },
  { member: "delivered_recent", tone: "settled", noteTone: "settled" },
];
