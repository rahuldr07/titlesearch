import type { ReactNode } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { reportCrash } from "../../shared/crash";

/**
 * INVARIANT 59 — A PARTIAL FAILURE DEGRADES THAT REGION ONLY.
 *
 * One boundary PER SCREEN, wrapped by the root route around `<Outlet/>`, so a
 * screen that throws takes the screen and not the chrome: the rail keeps its
 * doors and the order strip keeps its identity, which is the half of the
 * invariant a single app-level boundary cannot satisfy.
 *
 * `resetKeys` on the pathname is what makes it recoverable without a reload —
 * `react-error-boundary` resets when a key changes, so navigating away from a
 * broken screen and back gives you a fresh attempt. Without it the boundary
 * latches and every subsequent route renders this card.
 *
 * ══ WHAT IT SHOWS, AND WHAT IT REFUSES TO SHOW ═════════════════════════════
 *
 * The error's `message` and nothing else. No stack, no component tree, no
 * request body. `shared/crash.ts` records why in detail: the backend's
 * structlog redaction exists to keep party names, field values and reasons out
 * of logs, and a client that paints them onto the screen has re-collected
 * exactly what the redaction removes. An `ApiError` message is the SERVER's
 * own sentence and is safe by the same argument that makes it renderable
 * anywhere else.
 *
 * Reporting goes through `reportCrash("caught", …)`, the same sink React's own
 * `onCaughtError` uses in `main.tsx`, so a boundary-caught error and an
 * uncaught one land in one pipeline rather than two.
 */
export function ScreenBoundary(props: {
  readonly resetKey: string;
  readonly children: ReactNode;
}) {
  return (
    <ErrorBoundary
      FallbackComponent={ScreenFailed}
      resetKeys={[props.resetKey]}
      onError={(error, info) =>
        /*
         * `react-error-boundary`'s `ErrorInfo.componentStack` is
         * `string | null`; React's own `onCaughtError` passes
         * `string | undefined`, which is what `reportCrash` takes. The two
         * spell "absent" differently and the conversion is done HERE rather
         * than by widening `reportCrash` — that function is shared with
         * React's three root handlers and loosening its signature to
         * accommodate one caller would let a null reach the crash payload,
         * where `component_stack` is already explicitly nullable and would
         * then have two spellings of nothing.
         */
        reportCrash("caught", error, {
          componentStack: info.componentStack ?? undefined,
        })
      }
    >
      {props.children}
    </ErrorBoundary>
  );
}

function ScreenFailed({ error, resetErrorBoundary }: FallbackProps) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      data-testid="screen-failed"
      role="alert"
      className="flex h-full flex-col items-start justify-center gap-6 overflow-y-auto p-14"
    >
      <span className="text-label font-semibold uppercase leading-flat tracking-caps text-state-halt">
        This screen stopped
      </span>
      <p className="max-w-320 text-body leading-body text-ink-secondary">{message}</p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="tp-state h-16 rounded-md border border-control-border bg-surface-panel px-10 text-meta font-semibold leading-flat text-ink-primary hover:bg-surface-sunken"
      >
        Try this screen again
      </button>
    </div>
  );
}
