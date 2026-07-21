import { Link } from "@tanstack/react-router";
import { errorLine } from "./notice";

/**
 * Router fallbacks. Both are PURE — no fetching, no TopBar, no nav chrome —
 * because they can render under /blind/* where nothing may leak in. The one
 * link goes to "/", which redirects through requireAccess to the role's home.
 */

function FallbackFrame({
  heading,
  title,
  body,
  testid,
}: {
  heading: string;
  title: string;
  body: string;
  testid: string;
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-bg p-[30px] font-sans text-ink">
      <div
        data-testid={testid}
        className="max-w-[460px] rounded-card border-[1.5px] border-dashed border-line-strong bg-card px-8 py-[30px] text-center"
      >
        <div className="mb-3 font-mono text-[20px] text-label">{heading}</div>
        <div className="text-[15px] font-semibold">{title}</div>
        <div className="mt-2 text-[12.5px] leading-[1.6] text-ink-secondary">
          {body}
        </div>
        <div className="mt-4">
          <Link to="/" className="text-[12.5px] font-semibold no-underline">
            start over →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function NotFoundCard() {
  return (
    <FallbackFrame
      testid="not-found"
      heading="— no such door —"
      title="Nothing lives at this address."
      body="The link is stale or mistyped. Every screen worth reaching has a door in the map (?) — this isn't one of them."
    />
  );
}

/**
 * Shown while a lazily-loaded route chunk resolves. PURE — no fetch, no
 * chrome — so it is safe under /blind/* (a chunk load is a JS asset request,
 * never an /api GET; the blindness floor is unaffected). Kept visually quiet:
 * a route swap that resolves in a few ms should not flash a loud card.
 */
export function RoutePending() {
  return (
    <div
      data-testid="route-pending"
      className="flex h-screen items-center justify-center bg-bg"
    >
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-line-mid border-t-ink-secondary" />
    </div>
  );
}

export function RouteErrorCard({ error }: { error: unknown }) {
  return (
    <FallbackFrame
      testid="route-error"
      heading="— render failed —"
      title="This screen failed to render."
      body={errorLine(error)}
    />
  );
}
