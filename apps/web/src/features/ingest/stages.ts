import type { CreateOrderRequest, IngestRejection, Order } from "@titlepipe/contract";

/**
 * THE FOUR STAGES OF INTAKE, AND THE ONE FUNCTION THAT BUILDS THE UPLOAD.
 *
 * The union makes the product rule unrepresentable-otherwise: there is no state
 * in which an order is uploaded AND queued in one step, because `accept` and
 * `accepted` are different members and only the server's acknowledgement moves
 * between them (INVARIANT 47, `docs/INVARIANTS.md:131`).
 */
export type Stage =
  | { readonly kind: "form" }
  | {
      readonly kind: "refused";
      readonly rejection: IngestRejection;
      readonly fileName: string;
    }
  | { readonly kind: "accept"; readonly order: Order; readonly fileName: string }
  | { readonly kind: "accepted"; readonly order: Order };

export const BLANK_ORDER: CreateOrderRequest = {
  client_id: "",
  external_ref: "",
  jurisdiction: "",
  state: "",
  county: "",
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
