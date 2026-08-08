import type {
  OrderPipelineResponse,
  OrderSignoffResponse,
  OrderCompletenessResponse,
  OrderFieldsResponse,
} from "@titlepipe/contract";
import type { RailBadgeTone } from "../nav/RailBadge";

/**
 * READING A SERVED ORDER INTO ONE RAIL STAGE — the pure half of the "THIS
 * ORDER" flow (Task 12). The queries that fetch what these functions read live
 * in `orderQueries.ts`; this file takes their answers and nothing else, which is
 * why every function here is a plain function of its arguments and testable
 * without a server.
 *
 * NOTHING HERE DECIDES STATE. Every `done` traces to a served `phase === "done"`
 * and every badge to a served count. That is the §3 line: the rail reports what
 * the pipeline says, and the moment it computes instead, it can disagree with
 * the screen it is pointing at.
 */
export interface StageAugment {
  done: boolean;
  badge: string | null;
  /**
   * The pill's tone, DECIDED HERE and carried to the badge. The export pairs
   * gaps with red and an unanswered review with amber (`navFlow`,
   * TitlePipe.dc.html:2928); a badge that picked its own colour from its own
   * number would be a severity rule living in a navigator (§3).
   */
  badgeTone?: RailBadgeTone;
}

/**
 * CONTRACT GAP — `OrderPipelineResponse.stages` (ingest/classify/signoff/gate/
 * extract/assemble/validate/qc/finalize) is a FINER-GRAINED list than the nav
 * flow (Upload/Questions/Processing/Completeness/Review/Delivered); the two
 * are different granularities, not a 1:1 table waiting to be written down.
 * The ids are quoted from the served response, not from memory: the previous
 * spelling here named four stages the pipeline does not have.
 *
 * Only three nav stages have a stage whose WHOLE JOB is the nav screen's
 * whole job, not a proxy standing in for it: `/questions` IS the sign-off
 * screen, `/completeness` IS the gate, and `/orders/:id/review` IS the review
 * step (mapped separately below, since its path is order-scoped). Those three
 * are mapped here.
 *
 * Upload, Processing and Delivered stay UNMAPPED on purpose. Upload spans
 * three raw stages (receive/split/classify); Processing already renders the
 * ENTIRE stage list on its own screen (`ProcessingScreen.tsx`), so no single
 * stage is "the" Processing state; Delivered has no corresponding stage at
 * all — the pipeline ends at `review`. Picking one sub-stage to stand for any
 * of the three would be inventing an aggregation rule the contract does not
 * state — the same shape of thing rule §3 forbids for confidence and counts.
 * They render as plain numbered entries: a real position, no checkmark, no
 * fabricated badge, until the contract grows a field that actually says so.
 */
const PIPELINE_STAGE_ID: Partial<Record<string, string>> = {
  "/questions": "signoff",
  "/completeness": "gate",
};

function phaseDone(
  pipeline: OrderPipelineResponse | undefined,
  stageId: string,
): boolean {
  return pipeline?.stages.find((stage) => stage.id === stageId)?.phase === "done";
}

/** Augment for one of the plain FLOW paths (Upload/Questions/.../Delivered). */
export function stageAugmentFor(
  path: string,
  data: {
    pipeline: OrderPipelineResponse | undefined;
    signoff: OrderSignoffResponse | undefined;
    completeness: OrderCompletenessResponse | undefined;
  },
): StageAugment {
  const stageId = PIPELINE_STAGE_ID[path];
  const done = stageId !== undefined && phaseDone(data.pipeline, stageId);

  if (path === "/questions") {
    // Same check `OrderStrip`'s own stamp already uses for this exact null.
    return { done, badge: data.signoff?.signed_by === null ? "open" : null };
  }
  if (path === "/completeness") {
    const gaps = data.completeness?.gaps.length ?? 0;
    // The export's red on this one pill (`tone` in `navFlow`): a gap holds the
    // run back from the most expensive step, which is a halt, not a workload.
    return { done, badge: gaps > 0 ? String(gaps) : null, badgeTone: "halt" };
  }
  return { done, badge: null };
}

/**
 * Augment for the dynamic `/orders/:id/review` stage.
 *
 * THE STAGE IS `qc`, NOT `review`. The pipeline's nine ids are ingest, classify,
 * signoff, gate, extract, assemble, validate, qc, finalize (pinned over the
 * wire by `mockOrderFixtures.test.ts`), and `qc` is the one labelled "Human QC
 * gate — the run stops here for you". This read asked for `review`, matched
 * nothing, and so returned `done: false` for every order that ever existed — a
 * checkmark that could not be drawn, on the one stage a reviewer is in.
 */
export function reviewAugment(data: {
  pipeline: OrderPipelineResponse | undefined;
  fields: OrderFieldsResponse | undefined;
}): StageAugment {
  const done = phaseDone(data.pipeline, "qc");
  // Same filter `OrderCounts`'s "Need you" tile counts — server-labelled
  // state, never confidence.
  const needYou =
    data.fields?.fields.filter((f) => f.state === "needs_review").length ?? 0;
  // Amber, as the export marks an unanswered review: work waiting on a person
  // is not the same signal as a run that has stopped.
  return { done, badge: needYou > 0 ? String(needYou) : null, badgeTone: "attend" };
}
