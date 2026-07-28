import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { DEMO_FAILED } from "./lifecycle";

/**
 * Failed orders, held OUTSIDE the board on purpose.
 *
 * A failed order has no stage to sit in. Dropping it into the nearest column
 * would make it look like work in progress and it would age quietly inside a
 * count that everyone reads as "normal waiting" — which is exactly how an order
 * goes missing for a week. Out here it is visibly not in the pipeline, and the
 * copy states the consequence: it will sit until a person puts it back.
 *
 * This is the one halt-coloured block on the screen. The stages are violet
 * because being stopped on a person is the design; this is red because being
 * off the pipeline is not.
 *
 * No control on it. Requeueing a failed order is a real decision with a real
 * reason attached, and a button here would invite it to be made from a summary.
 */
export function FailedBanner() {
  if (DEMO_FAILED.length === 0) return null;

  return (
    <Card className="border-state-halt-border bg-state-halt-surface border-l-(length:--stroke-severity) border-l-state-halt">
      <div className="px-7 py-6">
        <Eyebrow variant="caption" tone="halt" as="h2">
          Off the pipeline — no stage to sit in
        </Eyebrow>
        <p className="mt-2 max-w-4xl text-xs leading-body text-ink-secondary">
          A failed order is not late, it is out. It needs a person to put it
          back, and it will sit here until someone does — which is why it is
          counted separately from the stages above rather than hidden inside one.
        </p>
        <ul className="mt-5 flex flex-wrap gap-4">
          {DEMO_FAILED.map((failed) => (
            <li
              key={failed.order}
              className="min-w-108 shrink basis-auto rounded-7 border border-state-halt-border bg-surface-panel px-5 py-4"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-xs font-semibold text-ink-primary">
                  {failed.order}
                </span>
                <span className="text-micro font-bold tracking-badge text-state-halt-ink uppercase">
                  {failed.state}
                </span>
              </div>
              <p className="mt-2 text-tiny leading-close text-ink-muted">{failed.addr}</p>
              <div className="mt-3 border-t border-line-subtle pt-3">
                <p className="font-mono text-tiny text-ink-secondary">{failed.waited}</p>
                <p className="mt-1 text-tiny leading-close text-ink-muted">{failed.waitOn}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
