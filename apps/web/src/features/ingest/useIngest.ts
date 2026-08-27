import { useMutation } from "@tanstack/react-query";
import {
  Ack,
  CreateOrderResponse,
  IngestRejection,
  type Order,
} from "@titlepipe/contract";
import { post } from "../../shared/api";

/**
 * THE TWO ACTS OF INTAKE, AND THEY ARE TWO ON PURPOSE.
 *
 * INVARIANT 47 (`docs/INVARIANTS.md:131`): "Acceptance is explicit — an upload
 * alone never queues an order." The design draws ONE "Sign" button and
 * `ANALYSIS-screens.md` §7 conversation 3 records that as blurring the two
 * acts. So there are two mutations here, they are never chained, and no
 * `onSuccess` on the first calls the second.
 *
 * `POST /api/orders` is MULTIPART (endpoints.ts:57), which is the one call in
 * this app that cannot go through `shared/api.ts` — that helper sets
 * `content-type: application/json` and serialises the body, and a FormData
 * body needs the browser to author the multipart boundary itself. So the fetch
 * is written out here, and the acceptance call — ordinary JSON — goes through
 * `post` like everything else.
 *
 * ══ THE REFUSAL IS THE SERVER'S, WHOLE ═════════════════════════════════════
 *
 * A 400 body is parsed as `IngestRejection` (endpoints.ts:49) and carried
 * intact to the screen, missing-field list and all. INVARIANTS 60-61: the
 * client never authors that list. A 409 is carried as its message string and
 * printed verbatim — INVARIANTS 64/132, the duplicate's sha256-match notice.
 */
export class RefusedError extends Error {
  readonly rejection: IngestRejection;

  constructor(rejection: IngestRejection) {
    super(rejection.reason);
    this.name = "RefusedError";
    this.rejection = rejection;
  }
}

/** The mock/server error envelope: `{ error: string }`. */
function messageOf(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const raw = (body as { error: unknown }).error;
    if (typeof raw === "string" && raw.length > 0) return raw;
  }
  return `POST /api/orders → ${status}`;
}

async function uploadPackage(form: FormData): Promise<CreateOrderResponse> {
  const response = await fetch("/api/orders", { method: "POST", body: form });
  const body: unknown = await response.json().catch(() => null);

  if (response.status === 400) {
    const rejection = IngestRejection.safeParse(body);
    // A 400 that is NOT a rejection shape is a different failure and must not
    // be dressed as one — it falls through to the generic path below.
    if (rejection.success) throw new RefusedError(rejection.data);
  }
  if (!response.ok) throw new Error(messageOf(body, response.status));

  const parsed = CreateOrderResponse.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Response did not match the contract for POST /api/orders: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function useUploadPackage(options: {
  readonly onUploaded: (order: Order) => void;
  readonly onRefused: (rejection: IngestRejection) => void;
  readonly onFailed: (message: string) => void;
}) {
  return useMutation({
    mutationFn: uploadPackage,
    onSuccess: (data) => options.onUploaded(data.order),
    onError: (error: Error) => {
      if (error instanceof RefusedError) options.onRefused(error.rejection);
      else options.onFailed(error.message);
    },
  });
}

/**
 * The second act. A named person signs for the package; nothing reaches a
 * reviewer until they do. `Ack` (endpoints.ts:34) carries no state back — the
 * server stays the only author of the order's state.
 */
export function useAcceptOrder(options: {
  readonly onAccepted: (order: Order) => void;
  readonly onFailed: (message: string) => void;
}) {
  return useMutation({
    mutationFn: (order: Order) => post(`/api/orders/${order.id}/accept`, Ack),
    onSuccess: (_ack, order) => options.onAccepted(order),
    onError: (error: Error) => options.onFailed(error.message),
  });
}
