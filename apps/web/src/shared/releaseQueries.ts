import { CompositionResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * THE RELEASE COMPILER'S ONE READ.
 *
 * `GET /api/orders/{id}/composition` carries the assembled manifest, the gate
 * verdicts, and the server's own `releasable`/`blocked_reason`/`seal_sha256`.
 * All four are ANSWERS: no screen evaluates a gate, counts a block, or decides
 * whether an order may be released.
 */
export function composition(orderId: string): ReadDescriptor<CompositionResponse> {
  return {
    path: `/api/orders/${orderId}/composition`,
    key: ["orders", orderId, "composition"],
    schema: CompositionResponse,
  };
}
