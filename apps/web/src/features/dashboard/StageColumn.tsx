import type { LifecycleStage } from "@titlepipe/contract";
import { Card, CardHeader, cx } from "../../components/ui";
import { OrderCard } from "./OrderCard";

/** ONE OF THE SEVEN COLUMNS. Everything printed here is server-authored. */
const KIND_INK: Record<LifecycleStage["kind"], string> = {
  idle: "text-ink-muted",
  halt: "text-state-attend",
  machine: "text-ink-secondary",
  done: "text-state-settled",
};

export function StageColumn(props: { readonly stage: LifecycleStage }) {
  const stage = props.stage;
  const shown = stage.orders.length;

  return (
    <Card padding="none" className="flex min-w-0 flex-col">
      <CardHeader className="flex-col items-stretch gap-3 px-6 py-6">
        <div className="flex items-baseline justify-between gap-4">
          {/* Rule 4: sentence case, and the words are the server's. */}
          <h2 className="min-w-0 font-sans text-meta leading-close font-semibold text-ink-primary">
            {stage.label}
          </h2>
          {/*
           * The census. `tabular-nums`, not `font-mono` — rule 3's list of what
           * mono is for is closed and a count is not on it (StatCard.tsx says
           * the same, for the same reason).
           */}
          <span
            data-stage-count={stage.count}
            className={cx(
              "shrink-0 font-sans text-subject leading-flat font-bold tabular-nums",
              KIND_INK[stage.kind],
            )}
          >
            {stage.count}
          </span>
        </div>

        <p className="font-sans text-label leading-flat font-normal text-ink-muted">
          {stage.sub}
        </p>
        <p className="font-sans text-label leading-flat font-normal text-ink-muted">
          Waiting on{" "}
          <span className="font-semibold text-ink-secondary">{stage.waiting_on}</span>
        </p>
      </CardHeader>

      <div className="flex min-w-0 flex-1 flex-col gap-4 px-6 py-6">
        {shown === 0 ? (
          /*
           * Rule 14 — absence is TYPED, never a blank — applied to a column.
           * Two different facts, two different sentences: a stage with nothing
           * in it, and a stage whose contents are not yours to open. `Empty`
           * from the barrel is deliberately not used: it is a whole-pane object
           * at 20px with 64px of padding, and seven of them side by side would
           * be the board rather than a note inside it.
           */
          <p className="font-sans text-label leading-body text-ink-muted">
            {stage.count === 0
              ? "Nothing in this stage."
              : "None of these are yours to open."}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {stage.orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </ul>
        )}

        {shown > 0 && shown !== stage.count && (
          <p className="font-sans text-label leading-body text-ink-muted">
            The census counts more than this list shows. It is scoped to what you may
            open; the count is not.
          </p>
        )}
      </div>
    </Card>
  );
}
