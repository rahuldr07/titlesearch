import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClientsResponse,
  ConfigResponse,
  CreateOrderResponse,
  IngestRejection,
} from "@titlepipe/contract";
import { get, post, type Validator } from "../../shared/api";
import { postForm } from "../../shared/apiForm";

/**
 * THE CLIENTS ARE ON THE WIRE — this screen does not get to invent them.
 *
 * `client_id` is the one field on the order that decides something: it resolves
 * the effective sign-off list. Typed free-hand, a transposed id is accepted by
 * the door and the wrong checklist is frozen onto the order, which nobody
 * discovers until a line that should have applied is missing from a delivered
 * search. A picker fed by the server cannot produce an id the server does not
 * have.
 *
 * Same query key as the clients screen uses, so the two share one cache entry
 * and can never show two different client lists. Declared again rather than
 * imported: features do not reach into each other (§7).
 */
export const clientsQuery = queryOptions({
  queryKey: ["clients"],
  queryFn: () => get("/api/clients", ClientsResponse),
});

/** The product catalogue, for the PRODUCT ORDERED grid. Same key, same reason. */
export const configProductsQuery = queryOptions({
  queryKey: ["config", "products"],
  queryFn: () => get("/api/config/products", ConfigResponse),
});

const Ack: Validator<{ ok: true }> = {
  safeParse: (input) =>
    typeof input === "object" && input !== null && (input as { ok?: unknown }).ok === true
      ? { success: true, data: { ok: true } }
      : { success: false, error: { message: "expected { ok: true }" } },
};

/**
 * THE PACKAGE AND THE ORDER ARRIVE TOGETHER OR NOT AT ALL.
 *
 * The five order fields are what the PDF cannot say — which client, which
 * reference, which county's rules apply — and a package without them is a stack
 * of pages nobody can produce a report from. The server refuses at the door and
 * names what is missing; the screen renders that list rather than authoring its
 * own (§4.3), so the two can never disagree about what "complete" means.
 */
export function useUploadPackage() {
  return useMutation({
    mutationFn: (form: FormData) =>
      postForm("/api/orders", CreateOrderResponse, IngestRejection, form),
  });
}

/**
 * ACCEPTANCE IS EXPLICIT AND SEPARATE (`ingest.spec` #2). An upload never
 * queues an order by itself: somebody signs for the package, and that signature
 * is what makes a missing document somebody's responsibility rather than a
 * mystery three weeks later.
 */
export function useAcceptOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => post(`/api/orders/${orderId}/accept`, Ack),
    onSuccess: () => client.invalidateQueries({ queryKey: ["queue"] }),
  });
}
