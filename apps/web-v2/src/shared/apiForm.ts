import { ApiError, type Validator } from "./api";
import { currentActor, currentRole } from "./session";

/** Shape of the mock server's error body. */
interface ErrorBody {
  error?: unknown;
}

/**
 * A REFUSAL THAT CARRIES DATA IS NOT AN ERROR CONDITION.
 *
 * The ingest door refuses an incomplete package by NAMING the missing fields
 * (`ingest.spec` #1), and that list is a structured answer the screen has to
 * render — not a message to log. Throwing it as an `ApiError` would reduce six
 * named fields to a status line, and the client would then have to author its
 * own list, which is exactly what §4.3 forbids.
 *
 * Multipart also means no `content-type` header: the browser must set the
 * boundary itself, and a hand-set header silently produces an unparseable body.
 */
export async function postForm<TOk, TRefusal>(
  path: string,
  ok: Validator<TOk>,
  refusal: Validator<TRefusal>,
  form: FormData,
): Promise<{ ok: true; data: TOk } | { ok: false; refusal: TRefusal }> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "x-mock-role": currentRole(), "x-mock-actor": currentActor() },
    body: form,
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const refused = refusal.safeParse(body);
    if (refused.success) return { ok: false, refusal: refused.data };
    // Anything else is a genuine failure and keeps the server's words.
    const message = (body as ErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      typeof message === "string" && message.length > 0
        ? message
        : `${response.status} ${response.statusText}`.trim(),
    );
  }

  const parsed = ok.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      response.status,
      `Response did not match the contract for ${path}`,
    );
  }
  return { ok: true, data: parsed.data };
}
