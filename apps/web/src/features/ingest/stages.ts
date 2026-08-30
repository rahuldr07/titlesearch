import type { CreateOrderRequest, IngestRejection, Order } from "@titlepipe/contract";

/**
 * THE STAGES OF INTAKE, POST-RULING.
 *
 * ⚠ RULED 2026-08-29 (`docs/frontend/design-2026-08/RULING-2026-08-29.md`):
 * the reference draws ONE act — "Sign for Package & Begin Dual-Engine
 * Extraction →" — so the old `accept` stage is gone. Uploading and signing
 * happen under one press (`useSignForPackage` chains the two calls), and the
 * union moves straight from `form` to `accepted` on the server's
 * acknowledgement, or to `refused` on its named rejection.
 */
export type Stage =
  | { readonly kind: "form" }
  | {
      readonly kind: "refused";
      readonly rejection: IngestRejection;
      readonly fileName: string;
    }
  | { readonly kind: "accepted"; readonly order: Order };

/**
 * Jurisdiction, state and county are NOT here, and cannot be: they left
 * `CreateOrderRequest` under RULING-2026-08-29 — the server resolves them
 * from the recorded clerk stamp, so the state overlay can never be
 * hand-picked wrong (CONFLICT-intake-hand-typed-jurisdiction.md, resolved).
 */
export const BLANK_ORDER: CreateOrderRequest = {
  client_id: "",
  external_ref: "",
  product: "",
};

/**
 * SEND WHAT WE HAVE, AND NOTHING WE DO NOT. An empty field is OMITTED rather
 * than sent blank, and a missing FILE is simply not appended, so the server sees
 * an ABSENCE and names it — INVARIANTS 60-61. Nothing is validated here: a
 * client-side gate would be a second list drifting from the server's from the
 * day it was written.
 */
export function packageForm(
  values: CreateOrderRequest,
  file: File | null,
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value.trim() !== "") form.append(key, value.trim());
  }
  if (file !== null) form.append("package", file);
  return form;
}
