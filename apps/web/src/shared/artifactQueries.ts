import { ArtifactsResponse } from "@titlepipe/contract";
import type { ReadDescriptor } from "./queries";

/**
 * `GET /api/orders/{id}/artifacts` — what `Report` never carried: a filename,
 * a media type, a byte count, the digest OF THE DELIVERED FILE, and the path
 * it is retrieved from. Order-scoped on the wire; each artifact names its own
 * `report_id`, which is how a row finds its version.
 */
export function artifacts(orderId: string): ReadDescriptor<ArtifactsResponse> {
  return {
    path: `/api/orders/${orderId}/artifacts`,
    key: ["orders", orderId, "artifacts"],
    schema: ArtifactsResponse,
  };
}
