import type { z } from "zod";
import { session } from "./session";

/** Non-2xx with the server's refusal message preserved — a 409/422 body is
 * the explanation the user must see, not debug noise. */
export class ApiError extends Error {
  readonly status: number;
  /**
   * The refusal body as it arrived. Kept because not every refusal is an
   * `{ error }` string: POST /api/orders answers an incomplete package with an
   * `IngestRejection` — the server's own list of what is missing, which the UI
   * must render verbatim and may not reconstruct. `unknown` on purpose, so a
   * caller cannot read it without parsing it through a contract schema first.
   */
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Thin fetch wrapper: every response is parsed against its contract schema,
 * so a drifted mock or server fails loudly at the boundary instead of
 * rendering wrong. The UI derives nothing (CONTEXT §7) — it renders what the
 * schema admits.
 */
export async function api<S extends z.ZodType>(
  schema: S,
  path: string,
  init?: RequestInit,
): Promise<z.output<S>> {
  const res = await fetch(path, {
    // x-mock-role / x-mock-actor stand in for the session/JWT role and identity
    // claims so the MSW handlers can enforce authz AND stamp the actor
    // server-side; both disappear when real auth (WorkOS session) lands. The
    // signer of an action is ALWAYS derived from this channel, never from a
    // request body field. Action names only ever travel in bodies — never URLs.
    headers: {
      // A multipart body (the ingest package upload) must keep the boundary
      // the browser generates for it — forcing application/json here makes the
      // server read an EMPTY form and refuse every field as missing, which
      // looks exactly like a real refusal. JSON stays the default for
      // everything else.
      ...(init?.body instanceof FormData
        ? {}
        : { "content-type": "application/json" }),
      "x-mock-role": session.role,
      "x-mock-actor": session.name,
    },
    ...init,
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const serverMsg =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : undefined;
    throw new ApiError(
      res.status,
      serverMsg ?? `${init?.method ?? "GET"} ${path} → ${res.status}`,
      body,
    );
  }
  return schema.parse(await res.json());
}
