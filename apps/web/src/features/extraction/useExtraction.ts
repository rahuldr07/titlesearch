import { useQuery } from "@tanstack/react-query";
import { OrderPagesResponse, OrderPipelineResponse } from "@titlepipe/contract";
import { get } from "../../shared/api";

/**
 * THE TWO READS EXTRACTION IS MADE OF, AND THERE IS NO THIRD.
 *
 *   - `GET /api/orders/{id}/pipeline` → `OrderPipelineResponse` (intake.ts:92):
 *     the stage list, the page totals, the classifier's note, and `gate_halted`.
 *   - `GET /api/orders/{id}/pages` → `OrderPagesResponse` (endpoints.ts:654):
 *     one row per page with `degraded` and `read_in_full` already decided.
 *
 * THE DESIGN'S THIRD SOURCE IS REFUSED. §Screens 6 draws a "dark terminal
 * (streams log lines with the run)". There is no endpoint, and the content is
 * probe-adjacent: `entities.ts:17-19` — "No Probe schema. Probes are never
 * visible in any client (CONTEXT §14). They must not exist in the contract a
 * screen could consume." A stream with no shape and no permission to exist is
 * not a fetch this file may add, and `ExtractionView` renders a `BackendGap`
 * where the terminal was drawn.
 *
 * ══ EVERY NUMBER ON THE SCREEN COMES OUT OF THE FIRST RESPONSE ═════════════
 *
 * Rule 11 — numbers reconcile across screens because they are one variable,
 * never two literals. `total_pages`, `pages_relevant` and `classifier_note` are
 * all `OrderPipelineResponse` members, and the hub reads the same endpoint. The
 * page matrix is `pages.map(...)` and its length is never printed as a count:
 * `OrderPagesResponse.pages` is a SAMPLE of the package (packages/mocks
 * data.ts:61-64 says so explicitly), so `pages.length` answers a different
 * question from `total_pages` and printing it would put two numbers on one
 * screen that disagree by design.
 */
export function usePipeline(orderId: string) {
  return useQuery({
    queryKey: ["orders", orderId, "pipeline"],
    queryFn: () => get(`/api/orders/${orderId}/pipeline`, OrderPipelineResponse),
  });
}

export function useOrderPages(orderId: string) {
  return useQuery({
    queryKey: ["orders", orderId, "pages"],
    queryFn: () => get(`/api/orders/${orderId}/pages`, OrderPagesResponse),
  });
}
