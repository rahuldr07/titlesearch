import { hasDoor } from "../../app/session/permissions";
import type { GrantedPermissionSchema } from "@titlepipe/contract";
import { RouteButton } from "../../app/chrome/RouteButton";

/**
 * The header band, drawn to the prototype's two-sided geometry. The kicker pill
 * ("TitleFlow Engine · Production Pipeline") is dropped: nothing in the contract
 * tells this screen which environment it is pointed at.
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
          <span className="flex items-center gap-4 rounded-lg border border-line-strong bg-surface-panel px-7 py-4 text-meta leading-close text-ink-muted">
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
