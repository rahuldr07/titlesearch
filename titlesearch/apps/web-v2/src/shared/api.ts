import { currentActor, currentRole } from "./session";

/**
 * A validator, described STRUCTURALLY rather than by importing Zod's types.
 *
 * Every schema in `@titlepipe/contract` satisfies this, so nothing changes at
 * runtime — but web-v2 never takes a direct dependency on zod, which keeps
 * §4's "no zod in the browser bundle" true of this package's own imports and
 * leaves the contract free to change validators without touching this file.
 */
export interface Validator<T> {
  safeParse(
    input: unknown,
  ): { success: true; data: T } | { success: false; error: { message: string } };
}

/**
 * The wire boundary. EVERY response is parsed through `@titlepipe/contract`
 * before it reaches a component — BRIEF §7 makes the contract authoritative on
 * shapes, and a response that does not match it is a bug we want to see loudly
 * rather than a `undefined` three components deep.
 *
 * Zod lives here rather than Valibot on purpose, and the reasoning is recorded
 * in BRIEF-DELTAS.md D-6: `packages/contract` is the shared REST contract that
 * `packages/mocks` is built on, and §7/§13 both say reuse the mocks unforked.
 * Valibot's role (§9.14) is form feedback, which is a different job.
 *
 * NO RETRY ON MUTATIONS, and no optimistic anything. Constraint 10 and
 * `review-conflict.spec`: the server's returned state is the truth, and a 409
 * is an ANSWER that must render — so `ApiError` carries the server's message
 * verbatim rather than a generic string.
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
      // DEV-ONLY (conflict C12). packages/mocks reads this in place of the
      // Clerk JWT claim so the harvested authz specs can prove the SERVER
      // refuses. It goes when the real API lands — see shared/session.ts.
      "x-mock-role": currentRole(),
      // DEV-ONLY, same cutover as the role. The mock signs the append-only
      // golden log with this rather than letting the client post a name in the
      // body — a signature the client can type is not a signature.
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
export function patch<T>(path: string, schema: Validator<T>, body: unknown): Promise<T> {
  return request(path, schema, { method: "PATCH", body: JSON.stringify(body) });
}
