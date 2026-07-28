import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  OrderFieldsResponse,
  OrderTimelineResponse,
  OrderPagesResponse,
  QueueNextResponse,
} from "@titlepipe/contract";
import { get, post, type Validator } from "../../shared/api";

const Ack: Validator<{ ok: true }> = {
  safeParse: (input) =>
    typeof input === "object" && input !== null && (input as { ok?: unknown }).ok === true
      ? { success: true, data: { ok: true } }
      : { success: false, error: { message: "expected { ok: true }" } },
};

export function orderFieldsQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "fields"],
    queryFn: () => get(`/api/orders/${orderId}/fields`, OrderFieldsResponse),
  });
}

/**
 * The spine's history, fetched SEPARATELY from the fields on purpose. A partial
 * failure must degrade only its own region (`errors.spec` #2): losing the
 * timeline must not take the order's identity down with it, because a reviewer
 * who cannot tell which order they are looking at is a reviewer who should stop.
 */
export function timelineQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "timeline"],
    queryFn: () => get(`/api/orders/${orderId}/timeline`, OrderTimelineResponse),
  });
}

/** The package's pages, as text. The citation on a field indexes into these. */
export function pagesQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "pages"],
    queryFn: () => get(`/api/orders/${orderId}/pages`, OrderPagesResponse),
  });
}

export const queueNextQuery = queryOptions({
  queryKey: ["queue", "next"],
  queryFn: () => get("/api/queue/next", QueueNextResponse),
});

/**
 * NO OPTIMISTIC UPDATES ON A FIELD DECISION (§9.10), and no retry on any of
 * these (`app/queryClient.ts`). The server's returned state is what renders:
 * a 409 saying the field was already confirmed with a different value is an
 * ANSWER, and painting the reviewer's version first would show them a decision
 * that never happened.
 */
function useFieldWrite<TBody>(orderId: string, action: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ fieldId, ...body }: TBody & { fieldId: string }) =>
      post(`/api/fields/${fieldId}/${action}`, Ack, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders", orderId, "fields"] }),
  });
}

export function useConfirmField(orderId: string) {
  return useFieldWrite<{ value: string | null }>(orderId, "confirm");
}

/** A correction is refused without its reason — the contract requires `min(1)`. */
export function useCorrectField(orderId: string) {
  return useFieldWrite<{ value: string | null; reason: string }>(orderId, "correct");
}

/** An escalation is refused without its question — likewise `min(1)`. */
export function useEscalateField(orderId: string) {
  return useFieldWrite<{ question: string }>(orderId, "escalate");
}

/**
 * SUPPRESS WITH REASON — rulebook R13, and the fourth thing a reviewer can do.
 *
 * A judgment hit that is not against our owner is not a wrong value and not a
 * question: it is a row that must not ship. Correcting it would file a
 * suppression as a value change, and escalating it would ask a senior a
 * question the reviewer has already answered.
 */
export function useExcludeField(orderId: string) {
  return useFieldWrite<{ reason: string }>(orderId, "exclude");
}

export function usePassOrder(orderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => post(`/api/orders/${orderId}/pass`, Ack, { reason }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["queue"] }),
  });
}
