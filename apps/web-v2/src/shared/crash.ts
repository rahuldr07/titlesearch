/**
 * THE CRASH SINK. Built, not bought — and the backend is what decides that.
 *
 * `services/core-api/src/titlepipe_core/telemetry/logging.py` redacts party
 * names, field values, results and reasons, allowlist-only in deployed
 * environments. Its docstring records that an earlier processor ordering
 * leaked a party name to stdout, which is why the redaction is written the way
 * it is.
 *
 * Sentry's default breadcrumbs capture DOM click text, console output and
 * fetch URLs. On this app that is: the party name a reviewer clicked, the
 * value they typed, the reason they gave. Precisely the class of data the
 * redaction exists to remove, re-collected client-side and shipped to a third
 * party. It is also 25.5 kB with no lite build.
 *
 * So: React 19's own error channels, two window listeners, and a POST through
 * the backend's existing redaction. 0 kB, and the events land in the same
 * pipeline as everything else.
 *
 * Sentry stays available as a PURCHASING decision if alerting and release
 * tracking are wanted as a product. It would need `beforeBreadcrumb` locked
 * down before it is safe here.
 */

/** Matches core-api's `X-Request-ID` validator: `^[A-Za-z0-9_.\-]{1,64}$`. */
function correlationId(): string {
  return crypto.randomUUID();
}

type CrashKind = "uncaught" | "caught" | "recoverable" | "window" | "rejection";

/**
 * Field names mirror the backend's structlog vocabulary on purpose: a string
 * read in a browser console can be grepped in staging without a translation
 * table. That is the entire argument against `loglevel` (1.4 kB, last
 * published 2024-09) and `consola` (2.2 kB) — thirty lines that match the
 * backend's own words beat a library that does not.
 */
interface CrashEvent {
  readonly event: "client_crash";
  readonly kind: CrashKind;
  readonly error_type: string;
  readonly error_message: string;
  readonly component_stack: string | null;
  readonly path: string;
  readonly request_id: string;
  readonly timestamp: string;
}

/**
 * `keepalive` so an unload-time crash still reaches the wire; failures are
 * swallowed because a crash reporter that throws during a crash turns one
 * defect into two.
 */
function send(event: CrashEvent): void {
  try {
    void fetch("/api/client-events", {
      method: "POST",
      keepalive: true,
      headers: {
        "content-type": "application/json",
        // Accepted inbound for cross-service correlation — `api/request_context.py:60`
        // generates one when absent and `app.py:90` lists the header in the CORS
        // allowlist, so the browser is EXPECTED to send it.
        "X-Request-ID": event.request_id,
      },
      body: JSON.stringify(event),
    }).catch(() => {});
  } catch {
    /* A reporter that throws during a crash makes one defect into two. */
  }
}

function describe(error: unknown): { type: string; message: string } {
  if (error instanceof Error) {
    return { type: error.name, message: error.message };
  }
  return { type: typeof error, message: String(error) };
}

/**
 * Report a React-surfaced error. Wired to `createRoot`'s three handlers in
 * `main.tsx`.
 *
 * `componentStack` is React's own and names component types, not user data.
 */
export function reportCrash(
  kind: CrashKind,
  error: unknown,
  info?: { componentStack?: string | undefined },
): void {
  const { type, message } = describe(error);
  send({
    event: "client_crash",
    kind,
    error_type: type,
    error_message: message,
    component_stack: info?.componentStack ?? null,
    path: window.location.pathname,
    request_id: correlationId(),
    timestamp: new Date().toISOString(),
  });
}

/**
 * The two channels React does not see: errors outside the tree, and rejected
 * promises nobody caught. Installed once, before the first render, so a
 * failure DURING startup is still reported.
 */
export function installCrashSink(): void {
  window.addEventListener("error", (e) => {
    reportCrash("window", e.error ?? new Error(e.message));
  });
  window.addEventListener("unhandledrejection", (e) => {
    reportCrash("rejection", e.reason);
  });
}
