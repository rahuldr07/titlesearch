import type { OrderRow } from "@titlepipe/contract";

/**
 * RULE 6, SPENT ONCE: the row's single status signal is the WEIGHT of the
 * property address — live orders in primary ink at semibold, delivered ones
 * dropped to secondary at regular. Weight and position first; no capsule, no
 * tinted ref, no coloured due date, so a scan down the column reads open work
 * without a second thing to decode. The stage is stated in words beside it, so
 * the weight is never the only carrier.
 */
export function Address({ row }: { readonly row: OrderRow }) {
  const live = row.stage !== "delivered";
  return (
    <span className="flex min-w-0 items-baseline gap-4">
      <span
        className={
          live
            ? "truncate text-body leading-close font-semibold text-ink-primary"
            : "truncate text-body leading-close text-ink-secondary"
        }
      >
        {row.addr}
      </span>
      <span className="shrink-0 text-label leading-flat text-ink-faint">{row.place}</span>
    </span>
  );
}

/** Rule 14: absence is typed. Null assignment and a null due are each said. */
export function Absent({ children }: { readonly children: string }) {
  return <span className="text-meta leading-close text-ink-faint">{children}</span>;
}
