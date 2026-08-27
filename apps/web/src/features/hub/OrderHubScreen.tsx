import { useQuery } from "@tanstack/react-query";
import { get } from "../../shared/api";
import {
  orderCompleteness,
  orderContext,
  orderFields,
  orderPipeline,
  orderSignoff,
  orderTimeline,
  type ReadDescriptor,
} from "../../shared/queries";
import { Card } from "../../components/ui";
import { VerdictCard } from "./VerdictCard";
import { AutomatedOperations } from "./AutomatedOperations";
import { DeterministicChecks } from "./DeterministicChecks";
import { SpecificationsGrid } from "./SpecificationsGrid";
import { EventTrail } from "./EventTrail";

/**
 * SCREEN 4 — THE ORDER HUB, at `/orders/$orderId` (`authz.ts:66`,
 * `screen.review.enter`, SIGHTED — the order-scoped form of the `/orders` door;
 * `authz.ts:50` says a screen permission guards the route PREFIX).
 *
 * ══ SIX QUERIES, NOT ONE BLOB ══════════════════════════════════════════════
 *
 * The prototype holds one static `ORDER_DATA` per order carrying fields, tiers,
 * citations, scans, instruments AND counts. ANALYSIS-screens §4 records the
 * correction: that is "server, SPLIT ACROSS FIVE QUERIES", and it is six here
 * because the sign-off carries the signature this screen prints as a record.
 * Each is a separate cache entry that invalidates on its own terms — a
 * confirmed field must not blow away the timeline, and a refetched gate must
 * not refetch the package.
 *
 * ══ EVERY COUNT IS THE SERVER'S, VERBATIM ══════════════════════════════════
 *
 * There is NO ARITHMETIC ON THIS SCREEN. Not one `+`, not one `.filter().
 * length`, not one percentage. `OrderCensus` (`endpoints.ts:139-160`) exists
 * because the four figures the strip prints "were being computed in the browser
 * from the `fields` array" — including `no_source`, which is "the browser
 * ruling on provenance, a server judgement (hard rule 3) and one the screen
 * could not cite (principle 6)."
 *
 * Note what that means for `fields`: this screen reads `/api/orders/{id}/fields`
 * for its `census` and DOES NOT COUNT THE ARRAY BESIDE IT. The array is scoped
 * to what the caller may see; the census is not. "A total that shrank with your
 * permissions reads as work vanishing."
 *
 * ══ PARTIAL FAILURE DEGRADES ONE CARD ══════════════════════════════════════
 *
 * INVARIANT 59. Each card takes `T | undefined` and says so in its own words
 * when the server has not answered — so a 500 on the gate leaves the verdict,
 * the operations and the trail standing. There is no whole-screen spinner and
 * no whole-screen error: both would let one failed read blank five good ones.
 *
 * ══ IT OWNS NO SCROLLER, AND THAT IS DELIBERATE ════════════════════════════
 *
 * `app/chrome/OrderRoute.tsx` composes this above the extraction view and the
 * review placeholder inside ONE scroller, because they are three views of one
 * order and a reader moves down through them. A second `overflow-y-auto` here
 * would nest a scroller inside a scroller: the wheel would move the inner pane
 * to its end and then stop, and the extraction view below would be unreachable
 * without dragging a bar. So this is a `<section>` that flows, and the frame's
 * one-viewport rule (INVARIANT 60) is kept by the pane that owns it.
 */
export function OrderHubScreen(props: { readonly orderId: string }) {
  const id = props.orderId;

  const context = useRead(orderContext(id));
  const fields = useRead(orderFields(id));
  const pipeline = useRead(orderPipeline(id));
  const completeness = useRead(orderCompleteness(id));
  const signoff = useRead(orderSignoff(id));
  const timeline = useRead(orderTimeline(id));

  return (
    <section
      data-testid="order-hub"
      aria-label="Order hub"
      className="tp-screen-enter flex shrink-0 flex-col gap-10 p-14"
    >
      {context.isError ? (
        /*
         * The ONE read whose failure is the screen's failure: with no context
         * there is no order, and `orderContextFor` throws rather than returning
         * a placeholder because "a context response that quietly names nothing
         * is how a screen ends up printing a ref that belongs to no order."
         * The route turns that into a 404, and this renders it as one.
         */
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
      ) : (
        <>
          {/*
           * The verdict is the screen's subject, so it leads. `stamp` is the
           * server's already-chosen word; the census is optional and absent is
           * not zero.
           */}
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
          />

          <SpecificationsGrid context={context.data} signoff={signoff.data} />

          <EventTrail events={timeline.data?.events} />
        </>
      )}
    </section>
  );
}

/**
 * One read, from its descriptor. The descriptor pairs the path, the cache key
 * and the contract schema in `shared/queries.ts` so no two screens can spell
 * one endpoint two ways (rule 11 for cache keys); this is the three lines that
 * actually fetch it, and they live in `features/` because `check-rules.mjs`
 * keeps Query out of `shared/` and `entities/`.
 */
function useRead<T>(descriptor: ReadDescriptor<T>) {
  return useQuery({
    queryKey: descriptor.key,
    queryFn: () => get(descriptor.path, descriptor.schema),
  });
}
