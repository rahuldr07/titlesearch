import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreateOrderResponse, IngestRejection } from "@titlepipe/contract";
import { post, type Validator } from "../../shared/api";
import { postForm } from "../../shared/apiForm";

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
