import { useQuery } from "@tanstack/react-query";
import { orderFields } from "../../shared/queries";
import { get } from "../../shared/api";

/**
 * The four figures, and not one of them is counted here. `OrderCensus` is
 * the server's answer to "how many" — tallying the fields array in the
 * browser would be the client ruling on provenance, a server judgement. The
 * four members are printed, never tallied, and a census is never a rate.
 */
export function OrderCounts(props: { readonly orderId: string }) {
  const descriptor = orderFields(props.orderId);
  const fields = useQuery({
    queryKey: descriptor.key,
    queryFn: () => get(descriptor.path, descriptor.schema),
  });

  // A region that has not answered yet says nothing, rather than standing
  // four zeroes in for an answer nobody has given.
  if (fields.data === undefined) return null;

  const census = fields.data.census;
  /* Absent is not zero. `census` is optional on the wire and its silence is
     a statement: the server did not say. Printing `0 fields` would invent
     one. */
  if (census === undefined) {
    return (
      <span data-testid="order-counts" className="text-meta leading-flat text-ink-faint">
        No census on this order
      </span>
    );
  }

  return (
    <dl data-testid="order-counts" className="flex flex-wrap items-baseline gap-7">
      <Figure label="Fields" value={census.fields} />
      <Figure label="Auto-confirmed" value={census.auto_confirmed} />
      <Figure label="Need you" value={census.needs_review} />
      <Figure label="No source" value={census.no_source} />
    </dl>
  );
}

/** A count is data, so it is mono — and tabular, so 9 and 10 are one width. */
function Figure(props: { readonly label: string; readonly value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-label leading-flat text-ink-muted">{props.label}</dt>
      <dd className="font-mono text-meta font-semibold leading-flat tabular-nums text-ink-secondary">
        {props.value}
      </dd>
    </div>
  );
}
