import { ReconciliationResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/** The one order the routeless screen can name. See the note above. */
export const DEMO_ORDER_ID = "ord_demo_1";

export function reconciliation(
  orderId: string,
): ReadDescriptor<ReconciliationResponse> {
  return {
    path: `/api/reconciliation/${orderId}`,
    key: ["reconciliation", orderId],
    schema: ReconciliationResponse,
  };
}
