/**
 * The crash sink. Built, not bought — and REVIEW-01 B4 cut it back further.
 * `libs/domain/src/titlepipe_domain/redaction.py` redacts party names, field
 * values, results and reasons, allowlist-only in deployed environments — after
 * an earlier processor ordering leaked a party name to stdout.
 * Sentry's default breadcrumbs capture DOM click text, console output and
 * fetch URLs — on this app, the party name a reviewer clicked, the value they
 * typed, the reason they gave. Precisely what the redaction exists to remove,
 * re-collected client-side. 25.5 kB, no lite build. Still refused.
 * ══ WHAT B4 FOUND, AND WHAT CHANGED ════════════════════════════════════════
 * THE SINK HAD NO RECEIVER. `POST /api/client-events` appears nowhere in
 * `packages/contract/src/endpoints.ts` and nowhere in `services/core-api`.
 * Every crash POST was a 404, so the redaction this header leaned on had never
 * run on this payload — it had never reached a Python process at all.
 * THE PAYLOAD COULD SHIP A PARTY NAME. `error_message` carried `error.message`
 * verbatim, and `shared/api.ts` builds an `ApiError` from the server's refusal
 * message VERBATIM — which INVARIANT 14 and 16 REQUIRE it to be. A 409 on a
 * vesting correction plausibly reads "MARIA L. ESTRADA was corrected by
 * another reviewer"; any unhandled rejection put that on the wire, and
 * `window.location.pathname` made it attributable to an order.
 * Neither `error_message` nor `component_stack` is in `SAFE_DIAGNOSTIC_KEYS`
 * (`redaction.py:187-231`), so in a deployed environment they would have been
 * dropped entirely and in development they are logged VERBATIM. The irony is
 * exact: `sanitise_exception` (`redaction.py:413-428`) exists because an
 * exception message "routinely contains exactly what must never be logged …
 * A PARTY NAME FROM A DOMAIN REFUSAL". This client sent the raw `.message`
 * under a key that is not `exception`, so that function never touched it.
 * ══ THE DECISION: NO WIRE SINK ═════════════════════════════════════════════
 * RULING-2026-08-28 unfroze `packages/contract` — for endpoints A DESIGN
 * SCREEN NEEDS. A crash sink is not one: no screen in `reference-app.html`
 * draws it, so `POST /api/client-events` remains an addition that needs the
 * owner asked, not an agent inferring it from the ruling's edge. So the fetch
 * stays DELETED rather than pointed at a 404 — a sink with no receiver is
 * not observability, it is the appearance of it, and the appearance is what
 * stopped anyone checking that the redaction ran.
 * What remains is a console channel with a payload that is already safe to
 * ship the day an endpoint exists. Restoring the POST should be one function.
 * ══ THE PAYLOAD DISCIPLINE ═════════════════════════════════════════════════
 * Every field name below is in `SAFE_DIAGNOSTIC_KEYS`, and the values are
 * produced by `crashRedaction.ts`. There is no free-text field in this payload
 * at all, which is the only version of this that cannot leak.
 */

import { nowIso } from "./date";
import { errorName, templatedRoute } from "./crashRedaction";

/** Matches core-api's `X-Request-ID` validator: `^[A-Za-z0-9_.\-]{1,64}$`. */
function correlationId(): string {
  return crypto.randomUUID();
}

type CrashKind = "uncaught" | "caught" | "recoverable" | "window" | "rejection";

/**
 * Field names are `SAFE_DIAGNOSTIC_KEYS` members, checked one by one against
 * `redaction.py:187-231`. That is not cosmetic: a key outside the allowlist is
 * dropped in deployed and logged verbatim in development, which is the exact
 * shape of the B4 leak.
 * `event`, `error_name`, `error_code`, `route`, `request_id` and `timestamp`
 * are all allowlisted there. `error_message` and `component_stack` are GONE:
 * both were outside the allowlist and both carried data-controlled text.
 */
interface CrashEvent {
  readonly event: "client_crash";
  /** The channel that caught it. A closed vocabulary, so it is not free text. */
  readonly error_code: CrashKind;
  /** The exception TYPE. `sanitise_exception`'s discipline: a class name is code. */
  readonly error_name: string;
  /** Templated. Never `window.location.pathname`, which carries the order id. */
  readonly route: string;
  readonly request_id: string;
  readonly timestamp: string;
}

/**
 * Where a crash goes today: the console, and nowhere else.
 * B4: there is no `POST /api/client-events` in the frozen contract and none in
 * `services/core-api`, so the previous `fetch` was a 404 on every crash. The
 * payload is assembled to the backend's own vocabulary anyway, so this becomes
 * a wire sink again by restoring the POST here once the endpoint is agreed.
 * `console.error` and not `console.warn`: a crash is an error, and the browser
 * groups it where an on-call reader looks.
 */
function send(event: CrashEvent): void {
  try {
    console.error("client_crash", event);
  } catch {
    /* A reporter that throws during a crash makes one defect into two. */
  }
}

/**
 * Report a React-surfaced error. Wired to `createRoot`'s three handlers in
 * `main.tsx`.
 * THE `info` PARAMETER IS GONE, not ignored. React passes an object carrying
 * `componentStack`, and the old header called it "React's own, and it names
 * component types, not user data" — true of the component names, not of the
 * whole string, which in React 19 dev builds carries source file paths and can
 * carry `key` values from keyed lists. Rows keyed by a natural key would leak
 * one. An unused parameter is an invitation to start using it, so the
 * signature does not accept what it must not send. `main.tsx` still passes it;
 * JavaScript discards extra arguments, and the types below say two.
 */
export function reportCrash(kind: CrashKind, error: unknown): void {
  send({
    event: "client_crash",
    error_code: kind,
    error_name: errorName(error),
    route: templatedRoute(window.location.pathname),
    request_id: correlationId(),
    timestamp: nowIso(),
  });
}

/**
 * The two channels React does not see: errors outside the tree, and rejected
 * promises nobody caught. Installed once, before the first render, so a
 * failure DURING startup is still reported.
 * The rejection listener is the B4 path: an unhandled `ApiError` from a 409
 * arrives here, and its `.message` is a verbatim server refusal that may name
 * a party. Only `error.name` is read.
 */
export function installCrashSink(): void {
  window.addEventListener("error", (e) => {
    reportCrash("window", e.error ?? new Error(e.message));
  });
  window.addEventListener("unhandledrejection", (e) => {
    reportCrash("rejection", e.reason);
  });
}
