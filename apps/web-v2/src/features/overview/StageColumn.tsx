import type { LifecycleStage } from "@titlepipe/contract";
import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { EmptyNote } from "../../shared/ui/EmptyPanel";
import { cn } from "../../shared/ui/classNames";
import { OrderCard } from "./OrderCard";
import { countInk, STAGE_TONE } from "./stageTone";

/**
 * One stage of the pipeline, as a column.
 *
 * The header answers two questions before the reader looks at a single card:
 * what stage, and how many. The "stopped" mark comes from the stage's `kind`
 * and from nothing else — a column is not stopped because it has cards in it,
 * and inferring that would make the board disagree with the pipeline.
 *
 * An empty column says "Nothing here" rather than collapsing, so the shape of
 * the pipeline stays constant between glances. A board whose columns appear and
 * vanish cannot be read at speed.
 *
 * That line is an `EmptyNote` — RESOLVED AND EMPTY, never *not loaded*. The
 * screen returns `ScreenMessage` above this component while the census is in
 * flight, so by the time a column renders the server has answered and "nothing
 * here" is a fact rather than a guess. The italic is what carries it: a collapsed
 * column and a column that never arrived draw identically, and the italic marks
 * the line as the board talking ABOUT an absence rather than as a row of data.
 *
 * The design tints the machine column with a diagonal hatch. Not reproduced:
 * the only hatch in this codebase means "the document is silent on this field",
 * and reusing it here would attach a second meaning to a mark whose whole job
 * is to survive greyscale with exactly one.
 *
 * THE SUBTITLE AND THE WAITING-ON LINE ARE ON THE WIRE NOW (2026-07-30, Wave
 * 2): `LifecycleStage.sub` and `LifecycleStage.waiting_on`, server-authored, so
 * naming who a stage waits on is no longer the board asserting a routing rule.
 * They are not drawn here — the column's header is Wave 4's rebuild — and this
 * note records that they exist rather than that they are missing.
 */
export function StageColumn({ stage }: { stage: LifecycleStage }) {
  const tone = STAGE_TONE[stage.kind];

  return (
    <Card>
      <div className={cn("h-1.5", tone.bar)} />
      <div className="border-b border-line-subtle px-4 pt-5 pb-4">
        {/* `break-words` and `shrink-0` are load-bearing, not defensive. Stage
            labels are SERVER TEXT of unbounded length in a column that is a
            seventh of the board: "Completeness gate" overflowed its box and
            printed itself into the count, rendering "gate3". The count must
            keep its width and the label must break rather than escape. */}
        <div className="flex items-baseline gap-3">
          <h2 className="min-w-0 flex-1 text-xs leading-tight font-bold break-words text-ink-primary">
            {stage.label}
          </h2>
          <span
            className={cn(
              "shrink-0 font-mono text-lg leading-flat font-semibold",
              countInk(stage.kind, stage.count),
            )}
          >
            {stage.count}
          </span>
        </div>
        {stage.kind === "halt" ? (
          <div className="mt-3">
            <Chip tone="action" size="micro" bordered>■ stopped</Chip>
          </div>
        ) : null}
      </div>
      <div className="flex min-h-33 flex-col gap-3 p-4">
        {stage.orders.length === 0 ? (
          /* The note carries the voice; the column keeps the spacing — which is
             why `EmptyNote` has no padding of its own to fight with. */
          <div className="px-1 py-4">
            <EmptyNote>Nothing here</EmptyNote>
          </div>
        ) : (
          stage.orders.map((order) => <OrderCard key={order.order_ref} order={order} />)
        )}
      </div>
    </Card>
  );
}
