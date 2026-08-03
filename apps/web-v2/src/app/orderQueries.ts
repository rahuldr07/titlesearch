import { queryOptions } from "@tanstack/react-query";
import {
  OrderContextResponse,
  OrderPipelineResponse,
  OrderSignoffResponse,
  OrderCompletenessResponse,
  OrderFieldsResponse,
} from "@titlepipe/contract";
import { get } from "../shared/api";

/**
 * THE ORDER-SCOPED READS THE CHROME MAKES — every one of them, in one place.
 *
 * Split out of `orderLifecycle.ts`, which had become two jobs in one file: how
 * to ASK the server about an order, and how to READ the answer into a rail
 * stage. The second is pure and heavily reasoned; the first is five wrappers
 * that differ only in a URL and a schema. Keeping them together meant every
 * reader of the derivation scrolled past the fetch boilerplate, and the file
 * crossed the §6 line gate on the day a fifth query arrived.
 *
 * Same duplication convention `OrderStrip.tsx` documents: `app/` is not a
 * feature, but the URL and the shape are the one contract schema parses, so a
 * small wrapper here beats reaching into four features' internals for one query
 * each. TanStack Query dedupes by queryKey regardless of which file asked first,
 * which is what makes two subscribers to `context` cost one request.
 *
 * EVERY CALLER GATES THESE ON `chromeFor(...).fetches`. The capture seat must
 * make no order request at all (`AppChrome`'s blindness note); collecting them
 * here does not relax that — it makes the set a reader can count.
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

/**
 * The human reference for an order you have only the URL id of, plus the
 * server's own lifecycle stamp — label and tone already decided, so no screen
 * composes that word from `signed_by === null` or from anything else.
 *
 * TWO READERS, ONE KEY. `OrderStrip` prints the ref as `ORDER {ref}` and
 * `AppChrome` prints it in the rail's flow header. It was declared privately
 * inside `OrderStrip` — correct while it had one reader, and a second copy the
 * moment it had two.
 */
export function orderContextQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "context"],
    queryFn: () => get(`/api/orders/${orderId}/context`, OrderContextResponse),
  });
}
