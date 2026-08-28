import { Empty } from "../../components/ui";
import { useRead } from "../../app/useRead";
import { lifecycle } from "../../shared/dashboardQueries";
import { BoardState } from "./BoardState";
import { BoardCensus } from "./BoardCensus";
import { FailedBanner } from "./FailedBanner";
import { StageColumn } from "./StageColumn";

/**
 * SCREEN 2b — THE LIFECYCLE BOARD, at `/dashboard` (`authz.ts:69`).
 *
 * `unbuiltScreens.ts` described this door as binding `LifecycleResponse`
 * (`intake.ts:246`) and `LifecycleStage` (`intake.ts:224`) with "nothing
 * structural" missing, and that turned out to be true: every word, every
 * figure and every column on this screen arrives from one GET.
 *
 * ══ WHAT THE BOARD IS ══════════════════════════════════════════════════════
 *
 * Seven stages, in the server's order, each with the server's `label`, the
 * server's `sub` (what the stage IS), the server's `waiting_on` (who it waits
 * on) and the server's `count`. The order cards under a column are the subset
 * of that stage the reader may open. `scope_note` is the sentence that tells
 * them which of those two they are looking at, so it is the subhead.
 *
 * The screen composes NOTHING. There is no client-side stage vocabulary here —
 * no `Record<StageId, string>` of column names, no derived "who is holding
 * this", no ordering rule. `ANALYSIS-screens.md:355` names that as the failure
 * mode: "a client-side `Record<StepId, string>` is a second copy of product
 * copy that drifts silently from the first."
 *
 * ══ THE THREE NUMBERS RULES, IN ONE PLACE ══════════════════════════════════
 *
 *  1. `LifecycleStage.count` is server-supplied and is NOT `orders.length`
 *     (`intake.ts:217-222`). No `.length` reaches any rendered figure on this
 *     screen — `StageColumn` and `FailedBanner` each say so where it applies.
 *  2. The four top-level figures are `total`/`halted`/`moving`/`failed`,
 *     printed verbatim. Nothing is summed, differenced or percentaged:
 *     INVARIANT 5 puts counts on the server and `endpoints.ts:143-150` calls
 *     browser arithmetic over a census "a count nobody can audit against the
 *     pipeline". The columns are not added up to check `total`, either.
 *  3. No rate, no timer, no elapsed wait, no estimate, no pace word anywhere.
 *     INVARIANT 23 and root AGENTS.md ban them outright, and a board is the
 *     shape of screen they arrive on. `LifecycleOrder.waited` exists on the
 *     wire and is deliberately never drawn (see `OrderCard`); `/api/metrics`
 *     is not read.
 *
 * ══ SEVEN COLUMNS AND NO SIDEWAYS SCROLL ═══════════════════════════════════
 *
 * A kanban board's instinct is a horizontally scrolling track. INVARIANT 65 —
 * "the page never scrolls sideways at any supported width" — and the kit's own
 * `ScrollArea` refuse it in as many words: "There is no `horizontal`: a pane
 * that scrolls sideways and not down is not a shape this design has." So the
 * board is a seven-column grid whose columns share the width, every column is
 * `min-w-0` and every long string truncates or wraps inside it. The screen body
 * scrolls down, which is the one direction INVARIANT 60 allows.
 */
export function DashboardScreen() {
  const board = useRead(lifecycle);

  return (
    <div
      data-testid="dashboard-screen"
      className="tp-screen-enter flex h-full min-h-0 flex-col gap-12 overflow-y-auto px-16 pt-14 pb-32"
    >
      <header className="flex min-w-0 flex-col gap-3">
        <h1 className="font-sans text-title leading-tight font-bold text-ink-primary">
          Lifecycle
        </h1>
        {/*
         * The subhead is the SERVER'S sentence, not a description of the board
         * composed here. It is the only thing that distinguishes "every order in
         * the shop" from "your orders plus anything unclaimed", and the two read
         * identically without it.
         */}
        {board.data !== undefined && (
          <p className="max-w-320 font-sans text-body leading-body text-ink-secondary">
            {board.data.scope_note}
          </p>
        )}
      </header>

      <BoardState query={board} of="the lifecycle board">
        {(data) => (
          <div className="flex min-w-0 flex-col gap-12">
            <BoardCensus board={data} />
            <FailedBanner board={data} />

            {data.stages.length === 0 ? (
              <Empty
                title="No stages"
                reason="The census returned no stages at all. The board draws the stages the server sends and does not know a default set — if this persists it is a server answer, not an empty shop."
              />
            ) : (
              <div className="grid grid-cols-7 items-start gap-6">
                {data.stages.map((stage) => (
                  <StageColumn key={stage.id} stage={stage} />
                ))}
              </div>
            )}
          </div>
        )}
      </BoardState>
    </div>
  );
}
