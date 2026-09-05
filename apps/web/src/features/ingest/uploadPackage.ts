import {
  CreateOrderResponse,
  IngestRejection,
  QuarantineResponse,
} from "@titlepipe/contract";
import { mockAuthHeaders } from "../../shared/api";

/**
 * The two calls that cannot go through `shared/api.ts` — both are multipart,
 * and it sets `content-type: application/json` where FormData needs the
 * browser to author the boundary. This file is the whole of that exception.
 *
 * The refusal is the server's, whole: a 400 body is parsed as
 * `IngestRejection` and carried intact, missing-field list and all — the
 * client never authors that list. A 409 message prints verbatim.
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
function messageOf(body: unknown, status: number, path: string): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const raw = (body as { error: unknown }).error;
    if (typeof raw === "string" && raw.length > 0) return raw;
  }
  return `POST ${path} → ${status}`;
}

async function postForm(path: string, form: FormData): Promise<unknown> {
  /*
   * The seat travels with the multipart POST too. This call used to send no
   * credential at all and still succeeded, because the mock read a missing
   * `x-mock-role` as the dev-default admin — so the one screen that creates
   * orders was, on the wire, an anonymous caller being handed the widest role
   * in the table. No `content-type`: the browser has to set the multipart
   * boundary itself, and naming it here would corrupt the body.
   */
  const response = await fetch(path, {
    method: "POST",
    headers: mockAuthHeaders(),
    body: form,
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 400) {
    const rejection = IngestRejection.safeParse(body);
    // A 400 that is NOT a rejection shape is a different failure and must not
    // be dressed as one — it falls through to the generic path below.
    if (rejection.success) throw new RefusedError(rejection.data);
  }
  if (!response.ok) throw new Error(messageOf(body, response.status, path));
  return body;
}

/** `POST /api/orders` — the create half of the one signed act. */
export async function uploadPackage(form: FormData): Promise<CreateOrderResponse> {
  const body = await postForm("/api/orders", form);
  const parsed = CreateOrderResponse.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Response did not match the contract for POST /api/orders: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/**
 * `POST /api/intake/quarantine` — the pre-order gateway scan, run the moment a
 * file lands. The package alone; every verdict that comes back is the server's.
 */
export async function scanPackage(file: File): Promise<QuarantineResponse> {
  const form = new FormData();
  form.append("package", file);
  const body = await postForm("/api/intake/quarantine", form);
  const parsed = QuarantineResponse.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `Response did not match the contract for POST /api/intake/quarantine: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}
