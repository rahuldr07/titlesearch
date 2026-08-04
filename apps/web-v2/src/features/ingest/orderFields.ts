/**
 * The order fields the PDF cannot say AND no endpoint can offer as a list.
 *
 * `client_id` is deliberately NOT here any more: `GET /api/clients` serves the
 * clients, so it is chosen from `ClientPicker` and a typed id — which resolves
 * the wrong sign-off list when it is wrong — is no longer possible.
 */
export const ORDER_FIELDS = [
  { key: "external_ref", label: "Order #" },
  { key: "jurisdiction", label: "Jurisdiction" },
  { key: "state", label: "State" },
  { key: "county", label: "County" },
] as const;
