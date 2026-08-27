import {
  LifecycleResponse,
  OrderCompletenessResponse,
  OrderContextResponse,
  OrderFieldsResponse,
  OrderPipelineResponse,
  OrderSignoffResponse,
  OrderTimelineResponse,
  QueueNextResponse,
} from "@titlepipe/contract";

/**
 * THE READ SURFACE, AS DATA: one path and one cache key per endpoint a screen
 * reads, paired with the contract schema that validates it.
 *
 * WHY THIS FILE EXISTS AND WHY IT IS IN `shared/`. `check-rules.mjs` enforces
 * two things that pull in opposite directions:
 *
 *   - `cross-feature-import` — `features/overview` may not import
 *     `features/queue`. Both screens read `/api/queue/next` (the queue serves
 *     the order; the overview spotlights the same one), so one of them would
 *     otherwise have to restate the path and the key.
 *   - `presentational-fetches` — `shared/` and `entities/` may not import
 *     `@tanstack/react-query` at all.
 *
 * So this file carries the DESCRIPTION of a read and never performs one. No
 * `useQuery`, no `get`, no hook. Each feature calls Query itself with the
 * descriptor, which keeps fetching in `features/` where the rule wants it while
 * leaving exactly one spelling of every path and every key.
 *
 * Rule 11 restated for cache keys: two features naming `["orders", id,
 * "census"]` slightly differently are two caches, and two caches of one census
 * are the "one variable, never two literals" defect wearing a different hat —
 * except it fails silently, as a refetch nobody asked for and a stale number
 * nobody can explain.
 *
 * ══ WHAT IS DELIBERATELY ABSENT ════════════════════════════════════════════
 *
 * THERE IS NO ORDER-LIST DESCRIPTOR, because there is no order-list endpoint.
 * `endpoints.ts:69`: "GET /api/queue/next — server-ordered; there is no
 * browse/pick endpoint." `INVARIANTS:82-83` says the same as a rule. A
 * `listOrders` entry here would be the first line of a browse feature, and the
 * conflict that would make it necessary is escalated in
 * `docs/frontend/design-2026-08/CONFLICT-all-orders.md`, not absorbed.
 *
 * `/api/queue/bands` is likewise absent. It is READ SHAPES ONLY
 * (`endpoints.ts:77-82`) and whether the Mine band may be DRAWN AT ALL is open
 * ruling Q11 — it "sits against exactly one order, no list". AGENTS.md: do not
 * build past OPEN.
 */
export interface ReadDescriptor<T> {
  readonly path: string;
  readonly key: readonly unknown[];
  readonly schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: { message: string } } };
}

/**
 * THE ONLY HAND-OVER. `QueueNextResponse.order` is NULLABLE and null is an
 * answer — "the server has nothing for you" — never an empty list to browse.
 */
export const queueNext: ReadDescriptor<QueueNextResponse> = {
  path: "/api/queue/next",
  key: ["queue", "next"],
  schema: QueueNextResponse,
};

/** The shop-wide census. Every figure on it is the SERVER'S, never a length. */
export const lifecycle: ReadDescriptor<LifecycleResponse> = {
  path: "/api/lifecycle",
  key: ["lifecycle"],
  schema: LifecycleResponse,
};

export function orderContext(id: string): ReadDescriptor<OrderContextResponse> {
  return {
    path: `/api/orders/${id}/context`,
    key: ["orders", id, "context"],
    schema: OrderContextResponse,
  };
}

/**
 * Carries `census` (`OrderCensus`, endpoints.ts:160) — the four figures the
 * order strip and the hub print. OPTIONAL on the wire, and absent is NOT zero:
 * it is "the server did not say", and the screen prints the silence.
 */
export function orderFields(id: string): ReadDescriptor<OrderFieldsResponse> {
  return {
    path: `/api/orders/${id}/fields`,
    key: ["orders", id, "fields"],
    schema: OrderFieldsResponse,
  };
}

export function orderPipeline(id: string): ReadDescriptor<OrderPipelineResponse> {
  return {
    path: `/api/orders/${id}/pipeline`,
    key: ["orders", id, "pipeline"],
    schema: OrderPipelineResponse,
  };
}

export function orderCompleteness(id: string): ReadDescriptor<OrderCompletenessResponse> {
  return {
    path: `/api/orders/${id}/completeness`,
    key: ["orders", id, "completeness"],
    schema: OrderCompletenessResponse,
  };
}

export function orderSignoff(id: string): ReadDescriptor<OrderSignoffResponse> {
  return {
    path: `/api/orders/${id}/signoff`,
    key: ["orders", id, "signoff"],
    schema: OrderSignoffResponse,
  };
}

export function orderTimeline(id: string): ReadDescriptor<OrderTimelineResponse> {
  return {
    path: `/api/orders/${id}/timeline`,
    key: ["orders", id, "timeline"],
    schema: OrderTimelineResponse,
  };
}
