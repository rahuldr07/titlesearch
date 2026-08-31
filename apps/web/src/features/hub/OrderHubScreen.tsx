import { useRead } from "../../app/useRead";
import {
  orderCompleteness,
  orderContext,
  orderFields,
  orderPipeline,
  orderSignoff,
  orderTimeline,
} from "../../shared/queries";
import { Card } from "../../components/ui";
import { VerdictCard } from "./VerdictCard";
import { AutomatedOperations } from "./AutomatedOperations";
import { DeterministicChecks } from "./DeterministicChecks";
import { SpecificationsGrid } from "./SpecificationsGrid";
import { EventTrail } from "./EventTrail";

/**
 * The order hub at `/orders/$orderId`. Six reads, not one blob: each is a
 * cache entry that invalidates on its own terms, and a partial failure
 * degrades one band rather than the screen. No arithmetic here — every count
 * is the server's, and `fields` is read for its `census` without the array
 * beside it ever being counted (the array is permission-scoped; the census is
 * not). It owns no scroller: `OrderRoute` composes this above the extraction
 * view inside one, and a nested scroller would strand what follows.
 */
export function OrderHubScreen(props: { readonly orderId: string }) {
  const id = props.orderId;

  const context = useRead(orderContext(id));
  const fields = useRead(orderFields(id));
  const pipeline = useRead(orderPipeline(id));
  const completeness = useRead(orderCompleteness(id));
  const signoff = useRead(orderSignoff(id));
  const timeline = useRead(orderTimeline(id));

  if (context.isError) {
    // The one read whose failure is the screen's: with no context there is no
    // order, and `orderContextFor` throws rather than naming nothing.
    return (
      <section
        data-testid="order-hub"
        aria-label="Order hub"
        className="tp-screen-enter flex shrink-0 flex-col gap-12 px-16 py-16"
      >
        <Card>
          <div className="flex flex-col gap-4">
            <h1 className="text-subject font-bold leading-tight text-ink-primary">
              No order at this address
            </h1>
            <p className="text-meta leading-body text-ink-secondary">
              {context.error.message}
            </p>
            <p className="font-mono text-label leading-close text-ink-muted">{id}</p>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section
      data-testid="order-hub"
      aria-label="Order hub"
      className="tp-screen-enter flex shrink-0 flex-col gap-12 px-16 py-16"
    >
      <Card padding="none" className="overflow-hidden">
        {context.data !== undefined && (
          <VerdictCard
            stamp={context.data.stamp}
            census={fields.data?.census}
            orderId={id}
          />
        )}

        <AutomatedOperations
          stages={pipeline.data?.stages}
          classifierNote={pipeline.data?.classifier_note}
          gateHalted={pipeline.data?.gate_halted}
        />

        <DeterministicChecks
          gateOpen={completeness.data?.gate_open}
          gaps={completeness.data?.gaps}
          verifiedChecks={pipeline.data?.verified_checks}
        />
      </Card>

      <div className="grid grid-cols-2 items-start gap-12">
        <SpecificationsGrid context={context.data} signoff={signoff.data} />
        <EventTrail events={timeline.data?.events} />
      </div>
    </section>
  );
}
