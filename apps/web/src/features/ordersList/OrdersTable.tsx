import type { OrderFilter, OrdersPageResponse } from "@titlepipe/contract";
import { Button, Empty, Table } from "../../components/ui";
import { ORDER_COLUMNS } from "./orderColumns";
import { OrdersPager } from "./OrdersPager";

/** The grid's accessible name follows the filter — a reader paging the
    delivered list should not hear it announced as "All orders". */
const GRID_LABEL: Readonly<Record<OrderFilter, string>> = {
  all: "All orders",
  active: "Orders in pipeline",
  waiting: "Orders with queries and gaps",
  delivered: "Delivered orders",
};

const NOTHING_HERE: Readonly<Record<OrderFilter, string>> = {
  all: "No orders in this view",
  active: "Nothing is in the pipeline",
  waiting: "Nothing is waiting on records",
  delivered: "Nothing delivered yet",
};

/** `query` and `filter` are the server's echo, so the sentence names the term
    it actually matched rather than what is in the box a keystroke later. */
function emptyReason(data: OrdersPageResponse): string {
  if (data.query === "")
    return "New packages appear here the moment intake signs for them.";
  const where = data.filter === "all" ? "the queue" : "this tab";
  return `Nothing in ${where} matches "${data.query}" by ref, address, client, stage, product or assignee.`;
}

export function OrdersTable({
  data,
  clear,
  goToPage,
}: {
  readonly data: OrdersPageResponse;
  readonly clear: () => void;
  readonly goToPage: (page: number) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line-strong bg-surface-panel shadow-card">
      <div className="min-h-0 flex-1">
        <Table
          label={GRID_LABEL[data.filter]}
          rows={data.orders}
          columns={ORDER_COLUMNS}
          rowKey={(row) => row.id}
          empty={
            <Empty
              title={
                data.query === ""
                  ? NOTHING_HERE[data.filter]
                  : "No orders match your search"
              }
              reason={emptyReason(data)}
              action={
                data.query === "" ? undefined : (
                  <Button size="sm" onPress={clear}>
                    Clear search
                  </Button>
                )
              }
            />
          }
        />
      </div>
      <OrdersPager data={data} goToPage={goToPage} />
    </div>
  );
}
