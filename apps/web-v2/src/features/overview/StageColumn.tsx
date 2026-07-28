import { Card } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { cn } from "../../shared/ui/classNames";
import { OrderCard } from "./OrderCard";
import { countInk, STAGE_TONE } from "./stageTone";
import type { LifecycleStage } from "./lifecycle";

/**
 * One stage of the pipeline, as a column.
 *
 * The header answers three questions before the reader looks at a single card:
 * what stage, how many, and WHO IT IS STOPPED ON. That third line is why the
 * board is not a kanban — the columns are not buckets of work in progress, they
 * are named people-shaped waits, and "on abstractor" is more useful than any
 * count above it.
 *
 * An empty column says "Nothing here" rather than collapsing, so the shape of
 * the pipeline stays constant between glances. A board whose columns appear and
 * vanish cannot be read at speed.
 *
 * The design tints the machine column with a diagonal hatch. Not reproduced:
 * the only hatch in this codebase means "the document is silent on this field",
 * and reusing it here would attach a second meaning to a mark whose whole job
 * is to survive greyscale with exactly one.
 */
export function StageColumn({ stage }: { stage: LifecycleStage }) {
  const tone = STAGE_TONE[stage.kind];

  return (
    <Card>
      <div className={cn("h-1.5", tone.bar)} />
      <div className="border-b border-line-subtle px-5 pt-5 pb-4">
        <div className="flex items-baseline gap-3">
          <h2 className="min-w-0 flex-1 text-xs leading-tight font-bold text-ink-primary">
            {stage.label}
          </h2>
          <span className={cn("font-mono text-lg leading-flat font-semibold", countInk(stage.kind, stage.count))}>
            {stage.count}
          </span>
        </div>
        <p className="mt-1.5 text-tiny leading-close text-ink-muted">{stage.sub}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {stage.kind === "halt" ? (
            <Chip tone="action" size="micro" bordered>■ stopped</Chip>
          ) : null}
          <span className="text-micro tracking-badge text-ink-muted uppercase">on {stage.on}</span>
        </div>
      </div>
      <div className="flex min-h-33 flex-col gap-3 p-4">
        {stage.orders.length === 0 ? (
          <p className="px-1 py-4 text-tiny text-ink-muted italic">Nothing here</p>
        ) : (
          stage.orders.map((order) => <OrderCard key={order.order} order={order} />)
        )}
      </div>
    </Card>
  );
}
