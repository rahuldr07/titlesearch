import { ConfigResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "../../shared/queries";

/**
 * `GET /api/config/products` (workspace.ts:68) — the product grid intake's
 * Product select offers, drawn under RULING-2026-08-29 now that
 * `CreateOrderRequest` carries `product`.
 *
 * It lives in the feature rather than `shared/` because intake is its only
 * reader — `shared/*Queries` exists so TWO features can share one spelling of
 * one read (queries.ts:19-28), and there is no second feature here. If one
 * arrives, this moves there whole, keeping the single spelling of the key.
 */
export const productsConfig: ReadDescriptor<ConfigResponse> = {
  path: "/api/config/products",
  key: ["config", "products"],
  schema: ConfigResponse,
};
