import type { LifecycleStage } from "@titlepipe/contract";
import { OrderMiniCard } from "../../entities/order/OrderMiniCard";
import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { EmptyNote } from "../../shared/ui/EmptyPanel";
import { cn } from "../../shared/ui/classNames";
import { StageMark } from "./StageMark";
import { countInk, STAGE_TONE } from "./stageTone";

/**
 * One stage of the pipeline, as a column.
 *
 * THE HEADER IS FOUR LINES AND EVERY ONE OF THEM IS THE SERVER'S: what stage
 * and how many, what the stage IS (`sub`), the mark for who holds it, and who
 * it waits on (`waiting_on`). RULE: never emit a value you cannot cite — the
 * header used to carry the label alone, so an EMPTY column said nothing at all
 * about itself, which is precisely when a reader most needs to be told what
 * would be sitting there. FAILURE PREVENTED: the alternative on offer was the
 * screen composing its own label ("Intake · sign-off open"), which is a
 * browser inventing product copy and a routing rule in one line.
 *
 * `count` IS THE SERVER'S CENSUS AND IS NEVER `orders.length`. The card list is
 * scoped to what this caller may open; the census is not. A count that shrank
 * with your permissions would read as work disappearing rather than as work you
 * are not allowed to look at.
 *
 * The 3px cap is the stage's KIND colour — violet where a person is holding it.
 * It is not an "active column" mark: which column is live would have to be
 * derived from whose orders are in it, and deriving state in the browser is
 * what hard rule 3 forbids.
 *
 * An empty column says "Nothing here" rather than collapsing, so the shape of
 * the pipeline stays constant between glances. That line is an `EmptyNote` —
 * RESOLVED AND EMPTY, never *not loaded*: `OverviewScreen` returns a
 * `ScreenMessage` while the census is in flight, so by the time a column
 * renders the server has answered. The italic marks the line as the board
 * talking ABOUT an absence rather than as a row of data.
 */
export function StageColumn({ stage }: { stage: LifecycleStage }) {
  const tone = STAGE_TONE[stage.kind];

  return (
    <Card>
      <div className={cn("h-1.5", tone.bar)} />
      <div className="border-b border-line-subtle px-5 pt-5 pb-4">
        {/* `break-words` and `shrink-0` are load-bearing, not defensive. Stage
            labels are SERVER TEXT of unbounded length in a column that is a
            seventh of the board: "Completeness gate" overflowed its box and
            printed itself into the count, rendering "gate3". The count must
            keep its width and the label must break rather than escape. */}
        <div className="flex items-baseline gap-3">
          <h2
            data-testid="stage-label"
            className="min-w-0 flex-1 text-xs leading-tight font-bold break-words text-ink-primary"
          >
            {stage.label}
          </h2>
          <span
            className={cn(
              "shrink-0 font-mono text-census leading-flat font-semibold",
              countInk(stage.kind, stage.count),
            )}
          >
            {stage.count}
          </span>
        </div>
        <p data-testid="stage-sub" className="mt-2 text-tiny leading-close text-ink-muted">
          {stage.sub}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StageMark kind={stage.kind} />
          {/* "ON" is written in the markup because a CSS transform does not
              change what text says. The actor is the SERVER'S word and is only
              cased by the eyebrow — the board does not decide who holds a
              stage, and a client-side `Record<StageKind, string>` here would be
              a second copy of a routing rule, drifting from the first. */}
          <Eyebrow variant="caption" data-testid="stage-waiting-on">
            ON {stage.waiting_on}
          </Eyebrow>
        </div>
      </div>
      <div className="flex min-h-33 flex-col gap-3 p-4">
        {stage.orders.length === 0 ? (
          /* The note carries the voice; the column keeps the spacing — which is
             why `EmptyNote` has no padding of its own to fight with. */
          <div className="px-1 py-4">
            <EmptyNote>Nothing here</EmptyNote>
          </div>
        ) : (
          stage.orders.map((order) => (
            <OrderMiniCard
              key={order.order_ref}
              ref={order.order_ref}
              place={`${order.addr} · ${order.county}`}
              waited={order.waited}
              waitingOn={order.waiting_on}
              mine={order.mine}
            />
          ))
        )}
      </div>
    </Card>
  );
}
