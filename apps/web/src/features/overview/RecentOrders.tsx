import type { OrdersPageResponse } from "@titlepipe/contract";
import { Card, Empty } from "../../components/ui";
import { QueryState } from "../../entities/state/QueryState";
import { useRead } from "../../app/useRead";
import { ordersPage } from "../../shared/ordersQueries";
import { RouteButton } from "../../app/chrome/RouteButton";
import { RecentOrderRow } from "./RecentOrderRow";

/**
 * The prototype's recent-orders table, built on the browse endpoint's first
 * page. The window is the server's — no slice, no length, no re-count.
 */
export function RecentOrders() {
  const recent = useRead(ordersPage({ query: "", filter: "all", page: 1 }));

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-6">
        <div className="flex items-baseline gap-5">
          <h2 className="text-body font-bold leading-tight text-ink-primary">Recent orders</h2>
          {recent.data !== undefined && (
            <span className="font-mono text-meta leading-close tabular-nums text-ink-faint">
              {recent.data.total} in all
            </span>
          )}
        </div>
        <RouteButton to="/orders" size="sm">
          View all orders →
        </RouteButton>
      </div>

      <QueryState query={recent} of="the recent orders">
        {(data) => <RecentTable data={data} />}
      </QueryState>
    </section>
  );
}

function RecentTable(props: { readonly data: OrdersPageResponse }) {
  if (props.data.orders.length === 0) {
    return (
      <Card padding="none">
        <Empty
          title="No orders on the first page"
          reason="The browse endpoint returned an empty page. That is the server's list, not a filter applied here."
        />
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="flex h-22 items-center border-b border-line-subtle bg-surface-sunken text-label font-semibold leading-flat text-ink-faint">
        <span className="w-65 shrink-0 px-6">Ref</span>
        <span className="min-w-0 flex-1 px-6">Property address</span>
        <span className="w-85 shrink-0 px-6">Client</span>
        <span className="w-55 shrink-0 px-6">Stage</span>
        <span className="w-60 shrink-0 px-6">Assigned</span>
        <span className="w-65 shrink-0 px-6 text-right">Due</span>
        <span className="w-60 shrink-0 px-6 text-right">Action</span>
      </div>

      {props.data.orders.map((row) => (
        <RecentOrderRow key={row.id} row={row} />
      ))}
    </Card>
  );
}
