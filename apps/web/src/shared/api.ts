import { currentRole } from "./session";

/**
 * A validator, described structurally rather than by importing Zod's types.
 * Every schema in `@titlepipe/contract` satisfies this, and the app takes no
 * direct dependency on zod — the contract stays free to change validators
 * without touching this file.
 */
export interface Validator<T> {
  safeParse(
    input: unknown,
  ): { success: true; data: T } | { success: false; error: { message: string } };
}

/**
 * The wire boundary. Every response is parsed through `@titlepipe/contract`
 * before it reaches a component — a response that does not match the
 * contract should fail loudly, not surface as `undefined` three components
 * deep. No retry on mutations, and no optimistic anything: the server's
 * returned state is the truth, and a 409 is an answer that must render, so
 * `ApiError` carries the server's message verbatim.
 */

export class ApiError extends Error {
  // Declared as fields rather than parameter properties: `erasableSyntaxOnly`
  // is on, and parameter properties emit runtime code that type-stripping
  // cannot erase.
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Shape of the mock server's error body. */
interface ErrorBody {
  error?: unknown;
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as ErrorBody)?.error;
    if (typeof message === "string" && message.length > 0) return message;
  } catch {
    // A non-JSON error body is not itself an error worth masking the status for.
  }
  return `${response.status} ${response.statusText}`.trim();
}

/**
 * Every mock-auth header this browser sends, minted in ONE place.
 *
 * The set matters as much as the value. core-api refuses a request carrying
 * any member of its own `MOCK_AUTH_HEADERS` (services/core-api →
 * api/mock_auth_guard.py) wherever mock auth is off, and that set holds
 * exactly `x-mock-role`. While the browser sent a second `x-mock-actor`
 * header, a request carrying only that one walked past the guard with a 200
 * against a production configuration — harmless only because nothing read it.
 * The gap would have opened at the ADR-0001 cutover, when `x-mock-role` is
 * dropped and a header nobody remembers is not dropped with it.
 *
 * So: one function, one header, and `mock-auth-parity.test.ts` fails if this
 * set and core-api's refusal set ever stop being the same set. Adding a
 * header here without adding it there is the bug, and it is now a red test
 * rather than a thing to notice.
 *
 * `uploadPackage.ts` calls this too — a multipart POST is a mutation, and it
 * needs a seat exactly as much as a JSON one does.
 */
export function mockAuthHeaders(): Record<string, string> {
  return { "x-mock-role": currentRole() };
}

async function request<T>(
  path: string,
  schema: Validator<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...mockAuthHeaders(),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }

  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    // A shape mismatch means the client and server disagree about reality.
    // Rendering half of it is how a wrong value reaches a delivered report.
    throw new ApiError(
      response.status,
      `Response did not match the contract for ${path}: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

export function get<T>(path: string, schema: Validator<T>): Promise<T> {
  return request(path, schema, { method: "GET" });
}

export function post<T>(
  path: string,
  schema: Validator<T>,
  body?: unknown,
): Promise<T> {
  return request(path, schema, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

/**
 * PATCH — a partial update. Used only for preferences today: everything else
 * that changes state does so through a named POST that means something in the
 * domain ("confirm", "escalate", "resolve"), because a generic partial update
 * is a state machine with no vocabulary.
 */
export function patch<T>(
  path: string,
  schema: Validator<T>,
  body: unknown,
): Promise<T> {
  return request(path, schema, { method: "PATCH", body: JSON.stringify(body) });
}
