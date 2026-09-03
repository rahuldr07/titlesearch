import type { ReactNode } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { reportCrash } from "../../shared/crash";

/**
 * A partial failure degrades that region only. The root route wraps
 * `<Outlet/>` in one of these, so a screen that throws takes the screen and
 * not the chrome; a screen whose panes must survive each other nests more.
 */
export function ScreenBoundary(props: {
  readonly resetKey: string;
  /**
   * What stopped, in the reader's words — "screen" unless a smaller region
   * owns its own boundary. It is named rather than described generically
   * because the reader has to know what is still trustworthy on the rest of
   * the screen.
   */
  readonly region?: string;
  readonly children: ReactNode;
}) {
  const region = props.region ?? "screen";
  return (
    <ErrorBoundary
      resetKeys={[props.resetKey]}
      /*
       * `info` is not forwarded. It carries `componentStack`, which dev
       * builds fill with source paths and keyed-list `key` values — a row
       * keyed by a party name would leak one. `reportCrash` does not accept
       * it.
       */
      onError={(error) => reportCrash("caught", error)}
      fallbackRender={(fallback) => <RegionFailed {...fallback} region={region} />}
    >
      {props.children}
    </ErrorBoundary>
  );
}

function RegionFailed({
  error,
  resetErrorBoundary,
  region,
}: FallbackProps & { readonly region: string }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      data-testid="screen-failed"
      data-region={region}
      role="alert"
      className="flex h-full flex-col items-start justify-center gap-6 overflow-y-auto p-14"
    >
      <span className="text-label font-semibold leading-flat text-state-halt">
        This {region} stopped
      </span>
      <p className="max-w-320 text-body leading-body text-ink-secondary">{message}</p>
      <button
        type="button"
        onClick={resetErrorBoundary}
        className="tp-state h-16 rounded-md border border-control-border bg-surface-panel px-10 text-meta font-semibold leading-flat text-ink-primary hover:bg-surface-sunken"
      >
        Try this {region} again
      </button>
    </div>
  );
}
