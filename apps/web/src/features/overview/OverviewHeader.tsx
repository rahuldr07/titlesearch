import { hasDoor } from "../../app/session/permissions";
import type { GrantedPermissionSchema } from "@titlepipe/contract";
import { RouteButton } from "../../app/chrome/RouteButton";

/**
 * THE OVERVIEW'S HEADER BAND, drawn to the prototype's geometry.
 *
 * `reference-app.html`'s `isQueue` block opens with a two-sided row that the
 * previous version of this screen did not have at all:
 *
 *     left   kicker pill · h1 28px w700 · subhead 16px, max-width 640
 *     right  "Intake New Package" 40px secondary · examiner chip, mono
 *
 * ══ THE KICKER PILL IS DROPPED ═════════════════════════════════════════════
 *
 * It reads "TitleFlow Engine · Production Pipeline". Both halves are claims
 * about the deployment rather than descriptions of the screen: nothing tells
 * this client which environment it is pointed at, and the product's name is
 * already printed two inches to the left in the rail. Filling the slot with the
 * screen's own name instead would put "Overview" directly above "Orders
 * overview", so the slot goes rather than gets padded.
 *
 * ══ THE H1 IS THE PROTOTYPE'S, IN SENTENCE CASE ════════════════════════════
 *
 * "Orders Overview" → "Orders overview". Rule 4 is "sentence case everywhere",
 * with ALL-CAPS confined to sidebar rubrics and serif certificate headings; a
 * screen title is neither. This is a casing rule, not a paraphrase — the words
 * are the prototype's.
 *
 * The previous version's h1 was `account.name`, which titles the screen with
 * the reader rather than the subject and left the app's root with no name at
 * all. The greeting is gone with it: the prototype has none, and the earlier
 * time-of-day variant needed a clock reading whose only purpose was decoration.
 *
 * ══ THE SUBHEAD IS THE SERVER'S SENTENCE ═══════════════════════════════════
 *
 * The prototype's own subhead asserts "SOC 2 delivery certification", which is
 * not a thing a browser may claim on a product's behalf. The slot keeps its
 * typography (16px, max-width 640 = `max-w-320` on the 2px grid) and takes
 * `LifecycleResponse.scope_note`, which the server authors and which is the
 * sentence a reader actually needs here: the four figures below mean different
 * things to different seats — a reviewer's board is scoped to their own orders
 * plus anything unclaimed, and the census is not scoped at all. The server says
 * which; the screen does not compose it.
 *
 * ══ THE RIGHT-HAND SIDE ════════════════════════════════════════════════════
 *
 * The intake button renders only where the role holds the door. INVARIANT 42/43
 * — a role-locked affordance is ABSENT, not disabled — and `hasDoor` is a
 * lookup in the projection `GET /api/me/permissions` already sent, never a
 * second evaluation of the permission table (INVARIANT 41).
 *
 * The examiner chip's dot pulses on a 2s infinite loop in the prototype. Rule
 * 10 allows 140ms on state and 260–300ms on entry and nothing else, so the dot
 * is drawn and does not animate.
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
            Examiner:{" "}
            {/* Rule 3: a role is an identifier the server gates on. */}
            <span className="font-mono font-semibold text-ink-primary">
              {props.role}
            </span>
          </span>
        )}
      </div>
    </header>
  );
}
