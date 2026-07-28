import { useState } from "react";
import { OverviewHeader, type OverviewView } from "./OverviewHeader";
import { TallyStrip } from "./TallyStrip";
import { StageBoard } from "./StageBoard";
import { StageRail } from "./StageRail";
import { FailedBanner } from "./FailedBanner";
import { useNarrowViewport } from "./useNarrowViewport";
import { DEMO_STAGES } from "./demoStages";

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
 *   - no names. Columns say "on abstractor", "on reviewer" — the role holding
 *     the order, never the person. A board that named people would become a
 *     ranking within a week.
 *   - no cherry-picking. Cards are not links to "take" an order; the queue
 *     decides what is next, and being able to shop the board for easy work is
 *     exactly the behaviour the queue's one-at-a-time design refuses.
 *   - no ageing alarm. Nothing turns red for sitting too long, because "too
 *     long" is a threshold and thresholds belong to the server.
 *
 * The narrow-window switch is forced rather than offered: a seven-column board
 * that has to be scrolled sideways has lost the between-column comparison it
 * exists for, so below the threshold the rail is the only honest view.
 */
export function OverviewScreen() {
  const narrow = useNarrowViewport();
  const [chosen, setChosen] = useState<OverviewView>("board");
  const view: OverviewView = narrow ? "rail" : chosen;

  return (
    <div className="flex flex-col gap-8">
      <OverviewHeader view={view} onView={setChosen} narrow={narrow} />
      <TallyStrip />
      {view === "board" ? (
        <StageBoard stages={DEMO_STAGES} />
      ) : (
        <StageRail stages={DEMO_STAGES} />
      )}
      <FailedBanner />
    </div>
  );
}
