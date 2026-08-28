import { Empty } from "../../components/ui";
import { useRead } from "../../app/useRead";
import { lifecycle } from "../../shared/dashboardQueries";
import { QueryState } from "../../entities/state/QueryState";
import { BoardCensus } from "./BoardCensus";
import { FailedBanner } from "./FailedBanner";
import { StageColumn } from "./StageColumn";

/**

 * SCREEN 2b — THE LIFECYCLE BOARD, at `/dashboard` (`authz.ts:69`).

 * `unbuiltScreens.ts` described this door as binding `LifecycleResponse`

 * (`intake.ts:246`) and `LifecycleStage` (`intake.ts:224`) with "nothing structural"

 * missing, and…

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

      <QueryState query={board} of="the lifecycle board">
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
      </QueryState>
    </div>
  );
}
