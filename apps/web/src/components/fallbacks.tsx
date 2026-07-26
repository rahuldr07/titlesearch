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
    <div className="flex h-screen items-center justify-center bg-surface-app p-[30px] font-sans text-ink-primary">
      <div
        data-testid={testid}
        className="max-w-[460px] rounded-md border-[1.5px] border-dashed border-line-strong bg-surface-panel px-8 py-[30px] text-center"
      >
        <div className="mb-3 font-mono text-[20px] text-ink-secondary">{heading}</div>
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
 * PASS 1 SCAFFOLD — delete in Pass 3 as each screen returns.
 *
 * The four screens design-mock replaces (queue, review, ingest, escalations)
 * were removed in the Pass 1 deletion commit. Their ROUTES stay, pointed here,
 * for two reasons: the surviving screens cross-link to them and those links are
 * themselves pinned by harvested invariants (a complaint deep-links into
 * review; a bench cell carries context into seed correction) — and a removed
 * route would turn every one of those links into a type error, forcing edits to
 * screens this commit is not supposed to touch.
 *
 * It says "being rebuilt", not "nothing lives here", because the address is
 * real. NotFoundCard would be a lie.
 */
export function RebuildingCard({ screen }: { screen: string }) {
  return (
    <FallbackFrame
      testid="rebuilding"
      heading="— under construction —"
      title={`${screen} is being rebuilt.`}
      body="The old screen was removed; its replacement lands in Pass 3. The rules it has to satisfy are parked as skipped specs in e2e/invariants/."
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
      className="flex h-screen items-center justify-center bg-surface-app"
    >
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-ink-secondary" />
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
