import { currentActor, currentRole } from "./session";

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

async function request<T>(
  path: string,
  schema: Validator<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      // Dev-only: packages/mocks reads this in place of the session claim so
      // the authz specs can prove the server refuses. It goes when the real
      // API lands — see shared/session.ts.
      "x-mock-role": currentRole(),
      // Dev-only, same cutover. The mock signs the golden log with this
      // rather than letting the client post a name in the body — a signature
      // the client can type is not a signature.
      "x-mock-actor": currentActor(),
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
