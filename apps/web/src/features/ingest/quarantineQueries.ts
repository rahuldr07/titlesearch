import { QuarantineResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "../../shared/queries";

/**
 * INTAKE'S ORDER-SCOPED READ. `GET /api/orders/{id}/quarantine` — shape at
 * design2.ts:35-42, served at packages/mocks design.ts:318 — added under the
 * 2026-08-28 ruling, which is what retired this feature's two gap cards.
 *
 * Everything on it is an ANSWER: each step's `state` is the server's
 * (`QuarantineState`, four members), each optical reading's `ok` is the
 * server's verdict against a threshold the client never sees, and
 * `sha256`/`duplicate_of` are data, not prose fished out of a 409.
 *
 * It lives in the feature rather than `shared/` because intake is its only
 * reader — `shared/*Queries` exists so TWO features can share one spelling of
 * one read (queries.ts:19-28), and there is no second feature here. If one
 * arrives, this moves there whole, keeping the single spelling of the key.
 */
export function quarantine(orderId: string): ReadDescriptor<QuarantineResponse> {
  return {
    path: `/api/orders/${orderId}/quarantine`,
    key: ["orders", orderId, "quarantine"],
    schema: QuarantineResponse,
  };
}
