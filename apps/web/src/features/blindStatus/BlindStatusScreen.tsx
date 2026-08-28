import type { ReconciliationResponse } from "@titlepipe/contract";
import { useRead } from "../../app/useRead";
import { CAPTURE_ORDER, reconciliation } from "../../shared/blindQueries";
import { Card } from "../../components/ui";
import { DivergenceList } from "./DivergenceList";
import { ProgrammeGaps } from "./ProgrammeGaps";
import { RosterGaps } from "./RosterGaps";
import { RelatedDoor } from "../../app/chrome/RelatedDoor";

/**
 * SCREEN — CAPTURE STATUS, at `/blind-status` (`authz.ts:77`,
 * `screen.blind-status.enter`, ops + admin).
 *
 * The ops read of the blind-fifty programme, and it is mostly a list of things
 * that do not exist yet. `unbuiltScreens.ts` records the door as binding to
 * `ReconciliationResponse` and that is literally the whole surface: there is no
 * `/api/blind-status`, no seat roster, no progress endpoint and no read of blind
 * entries anywhere in the contract. What CAN be read honestly is drawn; the
 * rest is four `ContractGap`s naming the missing shapes and the ask for each.
 *
 * A convincing mock of a progress dashboard would be worse than an empty
 * screen: it reads as finished to everybody who opens it, and the reader it
 * misleads worst is whoever is deciding what to build next.
 *
 * ══ WHAT IS BANNED HERE, NOT MERELY ABSENT ═════════════════════════════════
 *
 * No throughput, no per-typist rate, no timer, no estimate, no leaderboard.
 * INVARIANT 23 ("no pace indicators, no throughput language, no timers, and no
 * time ESTIMATES — an estimate is a pace indicator"), INVARIANT 26 ("no
 * approve-all, no throughput, no timers. Anywhere."), and AGENTS.md's
 * anti-pattern list. `PRODUCT.md` closes the loop: per-person throughput does
 * not exist as data anywhere in this system, so there is nothing to bind one to
 * even if a screen wanted it. The gaps say this out loud so a future progress
 * endpoint is not built carrying it.
 *
 * ══ THE ORDER IS STATED, NOT CHOSEN ════════════════════════════════════════
 *
 * Same reason as the seat: `/blind-status` takes no path param (authz.ts:77),
 * and there is no order-list endpoint to pick from (endpoints.ts:69, :77-82;
 * INVARIANT 22). The package is named once in `shared/blindQueries.ts`.
 *
 * ══ ONE THING THIS SCREEN CANNOT FIX, FLAGGED ══════════════════════════════
 *
 * `app/rootRoute.tsx` draws no rail where `pathname.startsWith("/blind")`,
 * which is INVARIANT 46 for the capture seat — and `/blind-status` matches the
 * same prefix, so an OPS reader lands here with no navigation either. That is a
 * shell decision in a file this screen does not own, and the fix is a
 * pathname test that distinguishes the two doors rather than anything drawn
 * here. Reported rather than worked around: a back link authored on this screen
 * would be the screen re-implementing the chrome's job.
 */
export function BlindStatusScreen() {
  const divergences = useRead(reconciliation(CAPTURE_ORDER));

  return (
    <div
      data-testid="blind-status"
      tabIndex={0}
      role="region"
      aria-label="Capture status"
      className="tp-state tp-screen-enter flex h-full min-h-0 flex-col gap-12 overflow-y-auto p-14"
    >
      <div className="flex max-w-500 flex-col gap-4">
        <h1 className="text-title font-bold leading-tight text-ink-primary">
          Capture status
        </h1>
        <p className="text-meta leading-body text-ink-secondary">
          How the blind measurement is going, as far as the contract can say.
          Reconciled divergences are the only published record of it; everything
          else an ops reader wants from this door is named below as a shape that
          does not exist yet.
        </p>
        <p className="text-meta leading-close text-ink-muted">
          Package{" "}
          <span data-testid="status-order" className="font-mono text-ink-primary">
            {CAPTURE_ORDER}
          </span>
        </p>
      </div>

      {/*
       * INVARIANT 59 — a partial failure degrades this region only. The gaps
       * below keep rendering when the read fails, because what the contract
       * lacks is true whether or not the server answered.
       */}
      <div className="flex max-w-500 flex-col gap-10">
        <ReadRegion query={divergences} />
        <RosterGaps />
        <ProgrammeGaps />
      </div>
      <RelatedDoor to="/reconciliation">Rule on a divergence in reconciliation →</RelatedDoor>
    </div>
  );
}

/**
 * THE THREE ANSWERS BEFORE DATA. `features/account/PanelState` is the same
 * three and is NOT imported: `check-rules.mjs`'s `cross-feature-import` forbids
 * one feature reaching into another, and the shared home that would fix it
 * (`entities/`) is outside this change. Same contract, restated: the frame is
 * authored here, the REASON is the server's (INVARIANT 14/58).
 */
function ReadRegion(props: {
  readonly query: {
    readonly isPending: boolean;
    readonly isError: boolean;
    readonly error: Error | null;
    readonly data: ReconciliationResponse | undefined;
  };
}) {
  if (props.query.isError) {
    /*
     * The FRAME is authored here — which region failed, and that it is
     * unavailable rather than empty. The REASON never is: INVARIANT 14, and a
     * fallback sentence standing in for a missing server message would be the
     * client authoring exactly the words the rule reserves. So the message is
     * rendered only when there is one.
     */
    return (
      <Card>
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-meta font-semibold leading-close text-state-halt">
            Could not read the divergences.
          </p>
          {props.query.error !== null && (
            <p className="text-meta leading-body text-ink-secondary">
              {props.query.error.message}
            </p>
          )}
        </div>
      </Card>
    );
  }

  if (props.query.isPending || props.query.data === undefined) {
    return (
      <Card>
        <p className="text-meta leading-body text-ink-muted">
          Reading the divergences…
        </p>
      </Card>
    );
  }

  return <DivergenceList rows={props.query.data.divergences} />;
}
