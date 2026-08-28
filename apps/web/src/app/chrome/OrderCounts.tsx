import { useQuery } from "@tanstack/react-query";
import { orderFields } from "../../shared/queries";
import { get } from "../../shared/api";

/**
 * THE FOUR FIGURES, AND NOT ONE OF THEM IS COUNTED HERE.
 *
 * `OrderCensus` (`endpoints.ts:160`) is the server's answer to "how many", and
 * the comment on it names this component as the reason it had to exist: the
 * strip used to filter the `fields` array for
 * `value !== null && source_doc_id === null && source_page === null &&
 * readings.length === 0` and print the result as `No source`. That is the
 * browser ruling on provenance — a server judgement (hard rule 3), and one the
 * screen could not cite. So the four members are printed, never tallied.
 *
 * A CENSUS, NEVER A RATE. Nothing here is per-hour, per-person or per-period,
 * and INVARIANT 23 means nothing here ever may be.
 */
export function OrderCounts(props: { readonly orderId: string }) {
  const descriptor = orderFields(props.orderId);
  const fields = useQuery({
    queryKey: descriptor.key,
    queryFn: () => get(descriptor.path, descriptor.schema),
  });

  // INVARIANT 59 — a region that has not answered yet says nothing, rather than
  // standing four zeroes in for an answer nobody has given.
  if (fields.data === undefined) return null;

  const census = fields.data.census;
  /* ABSENT IS NOT ZERO. `census` is optional on the wire and its silence is a
     statement: the server did not say. Printing `0 fields` would invent one. */
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

/** Rule 3: a count is data, so it is mono — and tabular, so 9 and 10 are one width. */
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
