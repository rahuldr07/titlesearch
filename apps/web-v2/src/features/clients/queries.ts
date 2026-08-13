import { queryOptions } from "@tanstack/react-query";
import { ClientsResponse, ConfigResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * Clients, their deltas, and the checklists the SERVER resolved from them.
 *
 * `effective` arrives alongside the clients rather than being computed here.
 * RESOLUTION IS SERVER WORK: at intake the same resolution freezes onto the
 * order, and a screen that re-derived it from the override list would give one
 * question two answers free to drift — which is exactly how a delivered search
 * ends up missing a line somebody thought was covered.
 */
export const clientsQuery = queryOptions({
  queryKey: ["clients"],
  queryFn: () => get("/api/clients", ClientsResponse),
});

/**
 * The product and line catalogue, for LABELS ONLY — a client's deltas are
 * unreadable without the baseline they differ from.
 *
 * Same endpoint and same query key as the products screen uses, so the two
 * share one cache entry and cannot show two config versions at once. It is
 * declared again here rather than imported: features do not reach into each
 * other, and a shared key is the supported way to share a response.
 */
export const configProductsQuery = queryOptions({
  queryKey: ["config", "products"],
  queryFn: () => get("/api/config/products", ConfigResponse),
});
