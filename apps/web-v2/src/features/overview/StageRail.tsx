import type { LifecycleStage } from "@titlepipe/contract";
import { Card } from "../../shared/ui/Card";
import { EmptyNote } from "../../shared/ui/EmptyPanel";
import { DividedSection, ListRow } from "../../shared/ui/ListRow";
import { cn } from "../../shared/ui/classNames";
import { countInk, STAGE_TONE } from "./stageTone";

/**
 * The same seven stages, stacked — one row each, orders reduced to pills.
 *
 * This is not a degraded board, it is a different question. The board asks
 * "where is the work piling up"; the rail asks "walk me down the pipeline". It
 * therefore drops the address and the wait reason and keeps only the order and
 * how long it has sat, because a row that tried to carry the card's four facts
 * would wrap and lose the one thing the rail is good at — a straight vertical
 * read of the stages in order.
 *
 * The spine keeps its stage colour so the two views stay learnable as one
 * language: violet is still "stopped on a person" here.
 *
 * `DividedSection` NAMES the boundary the `first:` exemption is measured
 * against. The rail draws seven rows and nothing else inside its list today, but
 * the exemption is a fact about the DOM, not about the stages: the moment a
 * scope banner or a filter is rendered as a sibling of the rows, the opening
 * hairline silently moves onto it and the rail starts with a rule hanging off
 * nothing — and only while that banner's condition happens to be true.
 */
export function StageRail({ stages }: { stages: readonly LifecycleStage[] }) {
  return (
    <Card>
      <DividedSection>
        {stages.map((stage) => {
          const tone = STAGE_TONE[stage.kind];
          return (
            <ListRow key={stage.id} className="flex flex-wrap items-start gap-7">
              <div className="flex min-w-0 shrink-0 basis-95 items-stretch gap-5">
                <span aria-hidden="true" className={cn("w-1.5 shrink-0 rounded-1", tone.bar)} />
                <div className="min-w-0">
                  <h2 className="text-xs leading-tight font-bold text-ink-primary">{stage.label}</h2>
                  {stage.kind === "halt" ? (
                    <span className="mt-2 block text-micro font-bold tracking-badge text-action-ink uppercase">
                      ■ stopped
                    </span>
                  ) : null}
                </div>
              </div>

              <span
                className={cn(
                  "shrink-0 basis-11 text-right font-mono text-lg font-semibold",
                  countInk(stage.kind, stage.count),
                )}
              >
                {stage.count}
              </span>

              <div className="flex min-w-0 flex-1 flex-wrap gap-3">
                {stage.orders.length === 0 ? (
                  <div className="self-center">
                    <EmptyNote>Nothing here</EmptyNote>
                  </div>
                ) : (
                  stage.orders.map((order) => (
                    <span
                      key={order.order_ref}
                      className={cn(
                        "inline-flex items-baseline gap-4 rounded-pill border px-6 py-2",
                        tone.chip,
                      )}
                    >
                      <span className="font-mono text-xs font-semibold text-ink-primary">
                        {order.order_ref}
                      </span>
                      {order.waited === null ? null : (
                        <span className="text-tiny text-ink-muted">{order.waited}</span>
                      )}
                    </span>
                  ))
                )}
              </div>
            </ListRow>
          );
        })}
      </DividedSection>
    </Card>
  );
}
