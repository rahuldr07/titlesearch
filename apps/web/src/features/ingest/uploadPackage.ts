import { CreateOrderResponse, IngestRejection } from "@titlepipe/contract";

/**
 * `POST /api/orders`, THE ONE CALL THAT CANNOT GO THROUGH `shared/api.ts`.
 *
 * The request is MULTIPART (endpoints.ts:57), and `shared/api.ts` sets
 * `content-type: application/json` and serialises the body where FormData needs
 * the browser to author the boundary. So the fetch is written out here, and
 * this file is the whole of that exception.
 *
 * THE REFUSAL IS THE SERVER'S, WHOLE. A 400 body is parsed as `IngestRejection`
 * (endpoints.ts:49) and carried intact to the screen, missing-field list and
 * all — INVARIANTS 60-61, the client never authors that list. A 409 is carried
 * as its message string and printed verbatim (INVARIANTS 64/132, the
 * duplicate's sha256-match notice).
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

export async function uploadPackage(form: FormData): Promise<CreateOrderResponse> {
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
