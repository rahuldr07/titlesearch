import type { OrderFilter, OrdersPageResponse } from "@titlepipe/contract";
import { Button, Empty, Table } from "../../components/ui";
import { ORDER_COLUMNS } from "./orderColumns";
import { OrdersPager } from "./OrdersPager";

const NOTHING_HERE: Readonly<Record<OrderFilter, string>> = {
  all: "No orders in this view",
  active: "Nothing is in the pipeline",
  waiting: "Nothing is waiting on records",
  delivered: "Nothing delivered yet",
};

/**
 * WHY THE EMPTY PANE READS THE SERVER'S ECHO. `query` and `filter` come back on
 * the response, so the sentence names the term the server actually matched on
 * rather than whatever is in the box a keystroke later.
 */
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
          label="All orders"
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
