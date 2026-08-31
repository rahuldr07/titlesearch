import type { CreateOrderRequest, IngestRejection, Order } from "@titlepipe/contract";

/**
 * The stages of intake. Uploading and signing happen under one press
 * (`useSignForPackage` chains the two calls), and the union moves straight
 * from `form` to `accepted` on the server's acknowledgement, or to `refused`
 * on its named rejection.
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
 * Jurisdiction, state and county are not here, and cannot be: the server
 * resolves them from the recorded clerk stamp, so the state overlay can never
 * be hand-picked wrong.
 */
export const BLANK_ORDER: CreateOrderRequest = {
  client_id: "",
  external_ref: "",
  product: "",
};

/**
 * Send what we have and nothing we do not: an empty field is omitted rather
 * than sent blank, and a missing file is not appended, so the server sees an
 * absence and names it. Nothing is validated here — a client-side gate would
 * be a second list drifting from the server's.
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
