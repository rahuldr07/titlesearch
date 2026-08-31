/**
 * The crash sink — console-only, deliberately. There is no client-events
 * endpoint in the contract or in core-api, so nothing goes on the wire.
 * The payload carries no free-text fields: server refusal messages can quote
 * party names, so only allowlisted diagnostic keys are ever assembled.
 */

import { nowIso } from "./date";
import { errorName, templatedRoute } from "./crashRedaction";

/** Matches core-api's `X-Request-ID` validator: `^[A-Za-z0-9_.\-]{1,64}$`. */
function correlationId(): string {
  return crypto.randomUUID();
}

type CrashKind = "uncaught" | "caught" | "recoverable" | "window" | "rejection";

/**
 * Every field name here must stay inside the backend redaction allowlist
 * (`redaction.py`). `error_message` and `component_stack` are deliberately
 * absent — both carried data-controlled text.
 */
interface CrashEvent {
  readonly event: "client_crash";
  /** The channel that caught it — a closed vocabulary, not free text. */
  readonly error_code: CrashKind;
  /** The exception type only. A class name is code; the message is not. */
  readonly error_name: string;
  /** Templated. Never `window.location.pathname`, which carries the order id. */
  readonly route: string;
  readonly request_id: string;
  readonly timestamp: string;
}

/**
 * Where a crash goes today: the console, and nowhere else. The payload already
 * matches the backend's vocabulary, so becoming a wire sink again is one
 * restored POST once an endpoint is agreed.
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
 * `main.tsx`. The signature takes no `info` parameter on purpose: React's
 * `componentStack` can carry source paths and `key` values from keyed lists,
 * which may be user data. `main.tsx` still passes it; JavaScript discards
 * extra arguments.
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
 * promises nobody caught. Installed before the first render so a failure
 * during startup is still reported. A rejection reason may be an `ApiError`
 * whose message is a verbatim server refusal — only `error.name` is read.
 */
export function installCrashSink(): void {
  window.addEventListener("error", (e) => {
    reportCrash("window", e.error ?? new Error(e.message));
  });
  window.addEventListener("unhandledrejection", (e) => {
    reportCrash("rejection", e.reason);
  });
}
