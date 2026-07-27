/** The five fields the PDF cannot say, in the order somebody reads them off a request. */
export const ORDER_FIELDS = [
  { key: "external_ref", label: "Order #" },
  { key: "client_id", label: "Client" },
  { key: "jurisdiction", label: "Jurisdiction" },
  { key: "state", label: "State" },
  { key: "county", label: "County" },
] as const;
