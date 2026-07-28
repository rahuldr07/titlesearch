import type { LifecycleStage } from "@titlepipe/contract";
import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
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
 * The design tints the machine column with a diagonal hatch. Not reproduced:
 * the only hatch in this codebase means "the document is silent on this field",
 * and reusing it here would attach a second meaning to a mark whose whole job
 * is to survive greyscale with exactly one.
 *
 * CONTRACT GAP: the wire carries no per-stage subtitle and no "on abstractor /
 * on a person" line. The design named who each stage waits on; the census does
 * not, and naming it here would be the board asserting a routing rule.
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
          <p className="px-1 py-4 text-tiny text-ink-muted italic">Nothing here</p>
        ) : (
          stage.orders.map((order) => <OrderCard key={order.order_ref} order={order} />)
        )}
      </div>
    </Card>
  );
}
