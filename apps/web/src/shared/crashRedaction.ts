/**
 * The two client-side redactors — the part of the crash sink that decides
 * what is safe to emit, kept apart from the listener plumbing so it can be
 * read and tested alone. Both mirror the backend's redaction rules.
 */

/**
 * The exception type, and nothing else. A class name is code; the message
 * after the colon is data — it is not shortened or hashed here, it is not
 * read at all, because a redactor that reads the string is one refactor away
 * from logging it. A non-Error throw yields its `typeof`, which is also code.
 * `String(error)` is deliberately not called.
 */
export function errorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  return typeof error;
}

/**
 * `window.location.pathname` with every identifier-shaped segment masked:
 * a resolved path names an order and makes a diagnostic attributable to the
 * file a reviewer had open; `/orders/:id/review` names a screen. Masking
 * rather than asking the router, because this runs before the first render —
 * there is no router yet. The rule is deliberately over-eager: a screen name
 * that trips it loses a little detail and leaks nothing.
 */
export function templatedRoute(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => {
      if (segment === "") return segment;
      const looksLikeId = /[0-9_]/.test(segment) || /^[0-9a-f]{8,}$/i.test(segment);
      return looksLikeId ? ":id" : segment;
    })
    .join("/");
}
