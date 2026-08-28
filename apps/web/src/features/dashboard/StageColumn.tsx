import type { LifecycleStage } from "@titlepipe/contract";
import { Card, CardHeader, cx } from "../../components/ui";
import { OrderCard } from "./OrderCard";

/**
 * ONE OF THE SEVEN COLUMNS. Everything printed here is server-authored.
 *
 * ══ `count` IS THE CENSUS AND `orders` IS THE LIST, AND THEY DIFFER ════════
 *
 * `intake.ts:217-222` states the rule this column exists to obey: "`count` is
 * SERVER-SUPPLIED and is not `orders.length`. The order list is scoped to what
 * the caller may see; the census is not. A stage count that shrank with your
 * permissions would read as work disappearing rather than as work you cannot
 * look at." So the figure in the header is `stage.count` and there is no
 * `.length` on any rendered number on this screen.
 *
 * The two genuinely diverge — `packages/mocks/src/workspace.ts:392-404` seeds a
 * Gates order that is in the census and in nobody's list precisely so the case
 * has data — and when they do, the column SAYS SO instead of quietly showing
 * fewer cards than its own number. That sentence is not a count and does not
 * compute one: `count` is printed, the cards are rendered, and the fact that
 * the two disagree is stated in words. Subtracting them would be the browser
 * publishing a figure the server never sent.
 *
 * ══ `kind` MAY BE SWITCHED ON. `state_label` MAY NOT ══════════════════════
 *
 * `StageKind` (`intake.ts:185`) is a four-member `z.enum` — a declared,
 * machine-readable axis, and mapping it to ink is the same move `LifecycleStamp`
 * sanctions for its `tone`: "`tone` is the only machine-readable axis." The
 * free strings beside it are not. `label`, `sub`, `waiting_on` and every
 * `state_label` below are printed and never inspected, because a `switch` on a
 * lifecycle word is a state machine moved one line down (`intake.ts:264-272`),
 * and hard rule 3 puts state machines on the server.
 *
 * The tone is a property of the STAGE, not of how full it is. A column that
 * turned amber above some number of cards would be a threshold, and thresholds
 * are the server's (AGENTS.md).
 *
 * ══ `sub` AND `waiting_on` ARE WHY AN EMPTY COLUMN STILL SPEAKS ════════════
 *
 * `intake.ts:226-238` asked for both: "The board drew a column header with
 * neither, so an empty stage said nothing at all about itself — and an empty
 * column is exactly when a reader most needs to be told what would be sitting
 * there." They are authored per stage on the server rather than derived from
 * `kind`, so nothing here composes them.
 */
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
            The census counts more than this list shows. It is scoped to what you
            may open; the count is not.
          </p>
        )}
      </div>
    </Card>
  );
}
