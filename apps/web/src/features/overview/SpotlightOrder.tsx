import type { Order } from "@titlepipe/contract";
import { Card } from "../../components/ui";
import { OrderRef } from "../../entities/order/OrderRef";
import { SpotlightMeta } from "./SpotlightMeta";
import { RouteButton } from "../../app/chrome/RouteButton";

/**

 * THE SERVED ORDER, drawn in the prototype's spotlight card. `reference-app.html`,

 * measured: card white, radius 14, border-left 4px #5B4B8A, 24px padding row 1 "Active

 * Spotlight" pill · SLA chip · "Assigned: …" row 2 ref 28px w700 mono…

 */
export function SpotlightOrder(props: { readonly order: Order }) {
  const order = props.order;

  return (
    <Card className="border-l-4 border-l-action">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <div className="flex min-w-0 flex-col gap-6">
          <span className="w-fit rounded-pill border border-line-strong bg-surface-sunken px-5 py-1 text-label font-semibold leading-flat text-ink-secondary">
            Active spotlight
          </span>

          <div className="flex flex-wrap items-baseline gap-7">
            <OrderRef orderRef={order.external_ref} emphasis="spotlight" />
            <span className="text-subject font-semibold leading-tight text-ink-primary">
              {order.jurisdiction}
            </span>
          </div>

          <SpotlightMeta order={order} />
        </div>

        <div className="flex shrink-0 items-center gap-6">
          {/*
           * `RouteButton`, not `LinkButton`: these are internal destinations
           * and `LinkButton` takes react-aria's `href`, a plain string that
           * nothing checks. `to`/`params` are checked against the route tree.
           */}
          <RouteButton
            variant="secondary"
            to="/orders/$orderId"
            params={{ orderId: order.id }}
            data-testid="spotlight-history"
          >
            Audit history
          </RouteButton>
          <RouteButton
            variant="primary"
            to="/orders/$orderId/review"
            params={{ orderId: order.id }}
            data-testid="spotlight-open"
          >
            Open review
          </RouteButton>
        </div>
      </div>
    </Card>
  );
}
