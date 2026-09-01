import { hasDoor } from "../../app/session/permissions";
import type { GrantedPermissionSchema } from "@titlepipe/contract";
import { RouteButton } from "../../app/chrome/RouteButton";

/**
 * The header band. The kicker pill and the lede are screen copy, like the
 * h1: fixed product prose, not a server figure, which is why neither rides
 * the wire.
 */
export function OverviewHeader(props: {
  readonly role: string | undefined;
  readonly rules: readonly GrantedPermissionSchema[] | undefined;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-8">
      <div className="flex min-w-0 flex-col gap-3">
        {/* The kicker pill. */}
        <span className="flex w-fit items-center gap-4 rounded-pill border border-action-border bg-action-surface px-5 py-2 text-label font-semibold leading-flat text-ink-secondary">
          <KickerGlyph />
          TitlePipe Engine · Production Pipeline
        </span>
        <h1 className="text-title font-bold leading-tight tracking-tight text-ink-primary">
          Orders Overview
        </h1>
        {/* The lede — fixed screen copy. */}
        <p className="max-w-320 text-body leading-body text-ink-secondary">
          Real-time abstract tracking across incoming packages, dual-engine
          extraction, human verification, and certified delivery.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-6">
        {hasDoor(props.rules, "/ingest") && (
          <RouteButton variant="secondary" to="/ingest">
            <PlusGlyph />
            Intake New Package
          </RouteButton>
        )}
        {props.role !== undefined && (
          <span className="flex items-center gap-4 rounded-lg border border-line-strong bg-surface-panel px-7 py-4 text-meta leading-close text-ink-muted">
            <span className="size-4 rounded-pill bg-state-settled" />
            Examiner: {/* A role is an identifier the server gates on. */}
            <span className="font-mono font-semibold text-ink-primary">
              {props.role}
            </span>
          </span>
        )}
      </div>
    </header>
  );
}

/** The kicker's four-square glyph. */
function KickerGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

/** The intake button's leading plus. */
function PlusGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
