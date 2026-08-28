import { useRead } from "../../app/useRead";
import { useSignedIn } from "../../app/session/signedIn";
import { hasAction, usePermissions } from "../../app/session/permissions";
import { engineRouting, engines } from "../../shared/engineQueries";
import { EngineReadState } from "./EngineReadState";
import { SeatChange } from "./SeatChange";
import { SeatTable } from "./SeatTable";

/**
 * THE SEATS — who sits where, and the one act that changes it.
 *
 * ══ WHY THE WRITE IS BUILT RATHER THAN LEFT READ-ONLY ══════════════════════
 *
 * `POST /api/engines/routing` is consequential enough to be worth refusing to
 * build. It is built anyway, because the REFUSAL is the product requirement and
 * a read-only table demonstrates none of it. `endpoints.ts:417` types
 * `evidence_url` as `z.string().min(1)`: a seat change without evidence does
 * not exist in the contract, and a screen that never offers the act never shows
 * a reviewer why. `SeatChange` states the hold in words while any of the four
 * pieces is missing, which is rule 9, and the server refuses independently
 * (`handlers.ts:1257`, role-gated on `routing.flip`).
 *
 * ══ THE AFFORDANCE IS ABSENT WITHOUT THE GRANT, NOT DISABLED ═══════════════
 *
 * INVARIANT 42: "a role-locked affordance is ABSENT, not disabled." `hasAction`
 * is a STRING COMPARISON against the server's own projection of this role
 * (`app/session/permissions.ts`) — not a policy evaluation, and not a second
 * permission table. In practice `screen.leaderboard.enter` and `routing.flip`
 * carry the same two roles (`authz.ts:75`, `authz.ts:114`), so anyone who can
 * open this screen holds the action; the lookup is here so that stops being
 * true safely rather than silently.
 *
 * ══ TWO READS, AND THE FORM WAITS FOR BOTH ═════════════════════════════════
 *
 * The seat table needs routing; the form additionally needs the roster, because
 * an engine id is not something a person should be typing. The table renders as
 * soon as routing arrives — INVARIANT 59, a partial failure degrades that
 * region only — and the form appears when its own read lands.
 */
export function SeatPane() {
  const routing = useRead(engineRouting);
  const roster = useRead(engines);
  const account = useSignedIn((state) => state.account);
  const permissions = usePermissions(account !== null);
  const mayFlip = hasAction(permissions.data?.rules, "routing.flip");

  return (
    <section aria-labelledby="engine-seats-heading" className="flex min-h-0 flex-col gap-6">
      <h2
        id="engine-seats-heading"
        className="text-label font-bold leading-flat text-ink-muted"
      >
        Current seats, and who approved each one with what evidence
      </h2>
      <EngineReadState query={routing} of="the seat assignments">
        {(data) => (
          <div className="flex min-h-0 flex-1 flex-col gap-10">
            {mayFlip && roster.data !== undefined && (
              <SeatChange cells={data.cells} engines={roster.data.engines} />
            )}
            <SeatTable cells={data.cells} />
          </div>
        )}
      </EngineReadState>
    </section>
  );
}
