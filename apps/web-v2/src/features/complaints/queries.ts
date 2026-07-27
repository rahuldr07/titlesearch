import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { ComplaintsResponse, OrderFieldsResponse } from "@titlepipe/contract";
import { get, post, type Validator } from "../../shared/api";

const AckResponse: Validator<{ ok: true }> = {
  safeParse: (input) =>
    typeof input === "object" && input !== null && (input as { ok?: unknown }).ok === true
      ? { success: true, data: { ok: true } }
      : { success: false, error: { message: "expected { ok: true }" } },
};

export const complaintsQuery = queryOptions({
  queryKey: ["complaints"],
  queryFn: () => get("/api/complaints", ComplaintsResponse),
});

/** The shipped report's fields, so a complaint can be captured against one. */
export function shippedFieldsQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "fields"],
    queryFn: () => get(`/api/orders/${orderId}/fields`, OrderFieldsResponse),
  });
}

export function useCaptureComplaint() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      order_id: string;
      field_path: string;
      client_value: string;
      description: string;
    }) => post("/api/complaints", AckResponse, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["complaints"] }),
  });
}

/**
 * RESOLVING A COMPLAINT IS REFUSED WITHOUT A RULE
 * (`delivery-complaints.spec` #5). A fix alone is not a resolution: re-issuing
 * v2 corrects one report and changes nothing about the next one. The rule is
 * what stops the same complaint arriving again in a month.
 *
 * Two paths, same as escalation resolution: cite an existing rule, or draft a
 * new one — which lands PENDING and cannot affect the pipeline until an
 * engineer confirms it.
 */
export function useResolveComplaint() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      resolution: string;
      rule: { rule_id: string } | { draft: { text: string } };
      golden_offer_accepted?: boolean;
    }) => post(`/api/complaints/${id}/resolve`, AckResponse, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["complaints"] }),
  });
}
