import { queryOptions } from "@tanstack/react-query";
import {
  OrderPipelineResponse,
  OrderSignoffResponse,
  OrderCompletenessResponse,
  OrderFieldsResponse,
} from "@titlepipe/contract";
import { get } from "../shared/api";

/**
 * Query wrappers + the pure derivation for the "THIS ORDER" numbered rail
 * (Task 12). Same duplication convention `OrderStrip.tsx` documents for its
 * own copy of the signoff query: `app/` is not a feature, but the URL and the
 * shape are the one contract schema parses, so a second small wrapper here
 * beats reaching into four features' internals for one query each — and
 * TanStack Query dedupes by queryKey regardless of which file asked first.
 */
export function orderPipelineQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "pipeline"],
    queryFn: () => get(`/api/orders/${orderId}/pipeline`, OrderPipelineResponse),
  });
}
export function orderSignoffQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "signoff"],
    queryFn: () => get(`/api/orders/${orderId}/signoff`, OrderSignoffResponse),
  });
}
export function orderCompletenessQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "completeness"],
    queryFn: () => get(`/api/orders/${orderId}/completeness`, OrderCompletenessResponse),
  });
}
export function orderFieldsQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "fields"],
    queryFn: () => get(`/api/orders/${orderId}/fields`, OrderFieldsResponse),
  });
}

export interface StageAugment {
  done: boolean;
  badge: string | null;
}

/**
 * CONTRACT GAP — `OrderPipelineResponse.stages` (receive/split/classify/
 * signoff/gate/extract/assemble/review) is a FINER-GRAINED list than the nav
 * flow (Upload/Questions/Processing/Completeness/Review/Delivered); the two
 * are different granularities, not a 1:1 table waiting to be written down.
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

function phaseDone(pipeline: OrderPipelineResponse | undefined, stageId: string): boolean {
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
    return { done, badge: gaps > 0 ? String(gaps) : null };
  }
  return { done, badge: null };
}

/** Augment for the dynamic `/orders/:id/review` stage. */
export function reviewAugment(data: {
  pipeline: OrderPipelineResponse | undefined;
  fields: OrderFieldsResponse | undefined;
}): StageAugment {
  const done = phaseDone(data.pipeline, "review");
  // Same filter `OrderCounts`'s "Need you" tile counts — server-labelled
  // state, never confidence.
  const needYou = data.fields?.fields.filter((f) => f.state === "needs_review").length ?? 0;
  return { done, badge: needYou > 0 ? String(needYou) : null };
}
