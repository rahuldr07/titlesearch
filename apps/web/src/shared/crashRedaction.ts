/**
 * The two client-side redactors, and why they are their own file.
 * Split from `crash.ts` (§6 length gate), and the seam is the right one: this
 * is the part that decides what is SAFE TO EMIT, and it is the part REVIEW-01
 * B4 found wrong. It should be readable, and testable, without reading the
 * listener plumbing around it.
 * Both mirror `libs/domain/src/titlepipe_domain/redaction.py`. See `crash.ts`
 * for the full B4 finding: an unhandled 409 rejection could put a verbatim
 * server refusal — "MARIA L. ESTRADA was corrected by another reviewer" — on
 * the wire, through the one code path INVARIANTS 14/16 mandate be verbatim.
 */

/**
 * The exception type, and nothing else.
 * This is `sanitise_exception` client-side: "the trailing `SomeExceptionType:
 * …` line, reduced to the type. A class name is code; the message after the
 * colon is data." The message is not shortened, hashed or sampled here — it is
 * not read at all, because a redactor that reads the string is one refactor
 * away from logging it.
 * A non-Error throw yields its `typeof` — "string", "object" — which is also
 * code and not content. `String(error)` is deliberately not called.
 */
export function errorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  return typeof error;
}

/**
 * `window.location.pathname` with every identifier-shaped segment masked.
 * `SAFE_DIAGNOSTIC_KEYS` allows `route` and says why: "the templated route,
 * never a resolved path". `/orders/ord_demo_1/review` names an order, which
 * makes any diagnostic attributable to the file a reviewer had open;
 * `/orders/:id/review` names a screen.
 * Masking rather than asking the router, because this module is installed
 * BEFORE the first render so a startup failure is still reported, and at that
 * moment there is no router to ask. The rule is deliberately over-eager: any
 * segment carrying a digit, an underscore or a long hex run is an id. A screen
 * name that trips it renders as `:id`, which loses a little detail and leaks
 * nothing — the failure direction this file must have.
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
