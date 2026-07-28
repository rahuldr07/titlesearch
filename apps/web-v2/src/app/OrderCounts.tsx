import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { OrderFieldsResponse } from "@titlepipe/contract";
import { get } from "../shared/api";
import { cn } from "../shared/ui/classNames";

function fieldsQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "fields"],
    queryFn: () => get(`/api/orders/${orderId}/fields`, OrderFieldsResponse),
  });
}

/**
 * The four numbers that describe an order, in the chrome, always visible.
 *
 * FIELDS · AUTO-CONFIRMED · NEED YOU · NO SOURCE. Three of those are ordinary
 * workload. The fourth is the one that matters: NO SOURCE counts values the
 * pipeline produced without a document, page or reading behind them, and
 * principle 6 says a value you cannot cite must never render as an ordinary
 * one. Putting the count in the chrome means nobody has to go looking for it.
 *
 * THESE ARE NOT A THROUGHPUT DISPLAY. There is no rate, no elapsed time and no
 * per-person number anywhere in this product. A count of what is left is the
 * shape of the work; a count per hour is a target, and a target is how a
 * reviewer learns to stop reading carefully.
 *
 * The counts are DERIVED FROM SERVER STATE ONLY — never from confidence, never
 * from `value === null`. The server owns which fields need a person.
 */
export function OrderCounts({ orderId }: { orderId: string }) {
  const { data } = useQuery(fieldsQuery(orderId));
  const fields = data?.fields ?? [];
  if (fields.length === 0) return null;

  const auto = fields.filter((f) => f.state === "auto_confirmed").length;
  const need = fields.filter((f) => f.state === "needs_review").length;
  const noSource = fields.filter(
    (f) =>
      f.value !== null &&
      f.source_doc_id === null &&
      f.source_page === null &&
      (f.readings ?? []).length === 0,
  ).length;

  const cell = (value: number, label: string, tone?: string) => (
    <div className="text-right">
      <div className={cn("text-md font-semibold leading-flat", tone)}>{value}</div>
      <div className="text-micro tracking-label uppercase text-ink-muted">{label}</div>
    </div>
  );

  return (
    <div data-testid="order-counts" className="hidden gap-6 lg:flex">
      {cell(fields.length, "Fields")}
      {cell(auto, "Auto-confirmed", "text-state-settled-ink")}
      {cell(need, "Need you", "text-action")}
      {cell(noSource, "No source", noSource > 0 ? "text-state-halt-ink" : "text-ink-muted")}
    </div>
  );
}
