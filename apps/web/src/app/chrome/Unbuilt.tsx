import type { ReactNode } from "react";

/**
 * A SCREEN THAT DOES NOT EXIST YET, SAYING SO.
 *
 * Not a mock. The design bundle ships a working prototype and it would be
 * cheap to transcribe its markup here with invented values — and that is the
 * one thing this must not do. Root AGENTS.md: "Never generate backend logic
 * from the UI/screens", and principle 6, "never emit a value you can't cite."
 * A placeholder full of plausible order refs and counts is a screen emitting
 * values it cannot cite, and it reads as finished to everybody who opens it.
 *
 * So each one names three things and nothing else: what the screen is, what
 * contract surface it will bind to, and what is missing. `needs` is
 * file:line into `packages/contract` wherever a surface exists, and the words
 * "no contract surface" wherever it does not — the analysis in
 * `docs/frontend/design-2026-08/ANALYSIS-screens.md` §1 is where those come
 * from.
 */
export function Unbuilt(props: {
  readonly screen: string;
  readonly door: string;
  readonly binds: string;
  readonly missing: ReactNode;
}) {
  return (
    // `tabIndex={0}`: a scrolling region must be keyboard-reachable, or a
    // reader who cannot use a pointer cannot reach the bottom of it (WCAG
    // 2.1.1). Named, because a bare tab stop announces nothing.
    <div
      data-testid="unbuilt"
      tabIndex={0}
      role="region"
      aria-label={`${props.screen} — not built`}
      className="tp-state flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-14"
    >
      <div className="flex flex-col gap-2">
        <span className="text-label font-semibold leading-flat text-ink-faint">
          Not built
        </span>
        <h1 className="text-title font-bold leading-tight text-ink-primary">
          {props.screen}
        </h1>
      </div>
      <dl className="flex max-w-full flex-col gap-5 rounded-lg border border-line-strong bg-surface-panel p-12">
        <Row term="Door">
          <span className="font-mono">{props.door}</span>
        </Row>
        <Row term="Binds to">{props.binds}</Row>
        <Row term="Missing">{props.missing}</Row>
      </dl>
    </div>
  );
}

function Row(props: { readonly term: string; readonly children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-8">
      <dt className="text-label font-semibold leading-airy text-ink-faint">
        {props.term}
      </dt>
      <dd className="text-meta leading-body text-ink-secondary">{props.children}</dd>
    </div>
  );
}

/**
 * INVARIANT 57 — an unknown route renders a NAMED not-found state, never a
 * blank page. Named for the reader: it says which path failed, because "not
 * found" without the path is a screen refusing to tell you what it refused.
 */
export function NotFound() {
  return (
    <div
      data-testid="not-found"
      className="flex h-full flex-col items-center justify-center gap-4 p-14"
    >
      <span className="text-label font-semibold leading-flat text-ink-faint">
        No screen at this address
      </span>
      <p className="text-body leading-body text-ink-secondary">
        <span className="font-mono">{window.location.pathname}</span> is not a door in
        this application.
      </p>
    </div>
  );
}
