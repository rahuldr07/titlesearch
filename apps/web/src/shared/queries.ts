import {
  EscalationsResponse,
  LifecycleResponse,
  OrderPagesResponse,
  OrderCompletenessResponse,
  OrderContextResponse,
  OrderFieldsResponse,
  OrderPipelineResponse,
  OrderSignoffResponse,
  OrderTimelineResponse,
  QueueNextResponse,
} from "@titlepipe/contract";

/**
 * The read surface, as data: one path and one cache key per endpoint a
 * screen reads, paired with the contract schema that validates it. This file
 * describes reads and never performs one — no `useQuery`, no `get`, no hook
 * (`shared/` may not import react-query, and features may not import each
 * other). Each feature calls Query itself with the descriptor, so every path
 * and every cache key has exactly one spelling — two near-identical keys are
 * two caches, failing silently as refetches and stale numbers.
 */
export interface ReadDescriptor<T> {
  readonly path: string;
  readonly key: readonly unknown[];
  readonly schema: { safeParse(input: unknown): { success: true; data: T } | { success: false; error: { message: string } } };
}

/**
 * The only hand-over. `QueueNextResponse.order` is nullable and null is an
 * answer — "the server has nothing for you" — never an empty list to browse.
 */
export const queueNext: ReadDescriptor<QueueNextResponse> = {
  path: "/api/queue/next",
  key: ["queue", "next"],
  schema: QueueNextResponse,
};

/** The shop-wide census. Every figure on it is the server's, never a length. */
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
 * Carries `census` — the four figures the order strip and the hub print.
 * Optional on the wire, and absent is not zero: it is "the server did not
 * say", and the screen prints the silence.
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

/** Pages as text. `degraded` is the server's finding, never inferred
 * client-side; `pages` is a sample, so its length is not a count. */
export function orderPages(id: string): ReadDescriptor<OrderPagesResponse> {
  return {
    path: `/api/orders/${id}/pages`,
    key: ["orders", id, "pages"],
    schema: OrderPagesResponse,
  };
}

/** The escalation list, shop-wide — no per-order endpoint exists; an order
 * view filters on `Escalation.order_ids`, the server's own join. Type is
 * inferred because the contract ships no companion type to import. */
type EscalationsShape = ReturnType<typeof EscalationsResponse.parse>;

export const escalations: ReadDescriptor<EscalationsShape> = {
  path: "/api/escalations",
  key: ["escalations"],
  schema: EscalationsResponse,
};
