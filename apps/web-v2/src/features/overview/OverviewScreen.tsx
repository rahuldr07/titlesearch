import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../../shared/ui/Screen";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";
import { OverviewHeader, type OverviewView } from "./OverviewHeader";
import { TallyStrip } from "./TallyStrip";
import { StageBoard } from "./StageBoard";
import { StageRail } from "./StageRail";
import { FailedBanner } from "./FailedBanner";
import { useNarrowViewport } from "./useNarrowViewport";
import { lifecycleQuery } from "./queries";

/**
 * WHERE EVERY ORDER SITS — the one screen that shows the pipeline whole.
 *
 * Everything else in this product is a seat: the queue hands you one order, the
 * review screen hands you one field. This board exists so that a person can
 * answer "what is actually going on" without being handed anything, and it is
 * deliberately the only screen that answers it.
 *
 * WHAT IS ABSENT IS THE DESIGN:
 *   - no throughput, no orders-per-hour, no burn-down, no trend line. This is a
 *     census of where things are, never a measure of how fast they move.
 *   - no names. The board says which stage holds an order, never who.
 *   - no cherry-picking. Cards are not links to "take" an order; the queue
 *     decides what is next, and being able to shop the board for easy work is
 *     exactly the behaviour the queue's one-at-a-time design refuses.
 *   - no ageing alarm. Nothing turns red for sitting too long, because "too
 *     long" is a threshold and thresholds belong to the server.
 *
 * A FAILED ORDER IS LIFTED OUT OF ITS COLUMN, never out of its count. The
 * server flags the order; the banner below the board is where flagged orders
 * are shown, because an order that needs a person to put it back should not sit
 * in a column ageing quietly among work that is progressing normally. Only the
 * card moves — every count on this screen stays the server's.
 *
 * The narrow-window switch is forced rather than offered: a seven-column board
 * that has to be scrolled sideways has lost the between-column comparison it
 * exists for, so below the threshold the rail is the only honest view.
 */
export function OverviewScreen() {
  const narrow = useNarrowViewport();
  const [chosen, setChosen] = useState<OverviewView>("board");
  const { data, isPending, isError } = useQuery(lifecycleQuery);
  const view: OverviewView = narrow ? "rail" : chosen;

  if (isError) return <ScreenMessage tone="halt" measure="1340">Overview unavailable.</ScreenMessage>;
  if (isPending) return <ScreenMessage measure="1340">Loading the board…</ScreenMessage>;

  const stages = data.stages.map((stage) => ({
    ...stage,
    orders: stage.orders.filter((order) => !order.failed),
  }));
  const failed = data.stages.flatMap((stage) => stage.orders).filter((order) => order.failed);

  return (
    <Screen measure="1340" pad="26x30" placement="top">
      <div className="flex flex-col gap-8">
        <OverviewHeader view={view} onView={setChosen} narrow={narrow} scopeNote={data.scope_note} />
        <TallyStrip
          total={data.total}
          halted={data.halted}
          moving={data.moving}
          failed={data.failed}
        />
        {view === "board" ? <StageBoard stages={stages} /> : <StageRail stages={stages} />}
        <FailedBanner orders={failed} />
      </div>
    </Screen>
  );
}
