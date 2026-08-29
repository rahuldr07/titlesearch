import { OrderFilter } from "@titlepipe/contract";
import { Segment, SegmentedControl } from "../../components/ui";
import { QueryState } from "../../entities/state/QueryState";
import { useRead } from "../../app/useRead";
import { ordersPage } from "../../shared/ordersQueries";
import { windowLabel } from "./ordersRange";
import { OrdersSearch } from "./OrdersSearch";
import { OrdersTable } from "./OrdersTable";
import { useOrdersBrowse } from "./useOrdersBrowse";

/**
 * All orders. Searching, filtering and paging are three query parameters on
 * `GET /api/orders`: this screen never filters, slices or counts an array.
 *
 * The header sits outside `QueryState` because it holds an uncontrolled search
 * box, and a box that unmounts mid-request loses the caret and the text.
 */
export function OrdersListScreen() {
  const browse = useOrdersBrowse();
  const query = useRead(
    ordersPage({ query: browse.query, filter: browse.filter, page: browse.page }),
  );
  /* The server's tally for the term it echoed back — absent while the read for
     a newly settled term is in flight, never a row count. */
  const matches = browse.query === "" ? undefined : query.data?.total;

  return (
    <div className="tp-screen-enter flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex flex-col gap-8 px-16 pt-14 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-title font-bold leading-tight text-ink-primary">
              All orders
            </h1>
            <p className="max-w-400 text-meta leading-body text-ink-secondary">
              Every order in the pipeline and the delivered record — search, filter, page.
            </p>
          </div>
          <OrdersSearch browse={browse} matches={matches} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-6">
          <SegmentedControl
            label="Which orders to show"
            selectedKeys={new Set([browse.filter])}
            onSelectionChange={(keys) => {
              const [first] = keys;
              const chosen = OrderFilter.safeParse(first);
              if (chosen.success) browse.choose(chosen.data);
            }}
          >
            <Segment id="all">All orders</Segment>
            <Segment id="active">In pipeline</Segment>
            <Segment id="waiting">Queries and gaps</Segment>
            <Segment id="delivered">Delivered history</Segment>
          </SegmentedControl>
          {query.data !== undefined && (
            <span className="font-mono text-meta leading-close text-ink-secondary">
              {windowLabel(query.data)}
            </span>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-16 pb-32">
        <QueryState query={query} of="the order list">
          {(data) => (
            <OrdersTable data={data} clear={browse.clear} goToPage={browse.goToPage} />
          )}
        </QueryState>
      </div>
    </div>
  );
}
