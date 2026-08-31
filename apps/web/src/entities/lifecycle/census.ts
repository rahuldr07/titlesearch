import type { LifecycleResponse } from "@titlepipe/contract";

/**
 * The overview's four stat cards, named once. The label, value and note all
 * arrive on the figure, server-authored; this table holds the only part
 * that is legitimately presentation — which member each card binds to, in
 * the design's order, and the tones it draws them in.
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
