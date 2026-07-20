import type { z } from "zod";
import { session } from "./session";

/** Non-2xx with the server's refusal message preserved — a 409/422 body is
 * the explanation the user must see, not debug noise. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
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
    // x-mock-role stands in for the Clerk JWT's role claim so the MSW
    // handlers can enforce the authz table server-side; it disappears when
    // real auth lands. Action names only ever travel in bodies — never URLs.
    headers: {
      "content-type": "application/json",
      "x-mock-role": session.role,
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
    );
  }
  return schema.parse(await res.json());
}
