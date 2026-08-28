import { hasDoor } from "../../app/session/permissions";
import type { GrantedPermissionSchema } from "@titlepipe/contract";
import { RouteButton } from "../../app/chrome/RouteButton";

/**

 * THE OVERVIEW'S HEADER BAND, drawn to the prototype's geometry.

 * `reference-app.html`'s `isQueue` block opens with a two-sided row that the previous

 * version of this screen did not have at all: left kicker pill · h1 28px w700 ·

 * subhead…

 */
export function OverviewHeader(props: {
  readonly scopeNote: string | undefined;
  readonly role: string | undefined;
  readonly rules: readonly GrantedPermissionSchema[] | undefined;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-8">
      <div className="flex min-w-0 flex-col gap-3">
        <h1 className="text-title font-bold leading-tight text-ink-primary">
          Orders overview
        </h1>
        {props.scopeNote !== undefined && (
          <p className="max-w-320 text-body leading-body text-ink-secondary">
            {props.scopeNote}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-6">
        {hasDoor(props.rules, "/ingest") && (
          <RouteButton variant="secondary" to="/ingest">
            Intake new package
          </RouteButton>
        )}
        {props.role !== undefined && (
          <span className="flex items-center gap-4 rounded-lg border border-line-strong bg-surface-panel px-7 py-4 text-meta leading-flat text-ink-muted">
            <span className="size-4 rounded-pill bg-state-settled" />
            Examiner: {/* Rule 3: a role is an identifier the server gates on. */}
            <span className="font-mono font-semibold text-ink-primary">
              {props.role}
            </span>
          </span>
        )}
      </div>
    </header>
  );
}
