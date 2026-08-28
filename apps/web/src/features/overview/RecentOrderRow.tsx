import { Link } from "@tanstack/react-router";
import type { OrderRow } from "@titlepipe/contract";

/**
 * One browse row, drawn to the prototype's seven tracks (130 · 1fr · 170 · 110
 * · 120 · 130 · 120). The whole row is the link, so "Open" is decoration.
 */
export function RecentOrderRow(props: { readonly row: OrderRow }) {
  const row = props.row;

  return (
    <Link
      to="/orders/$orderId"
      params={{ orderId: row.id }}
      data-recent-order={row.id}
      className="tp-state flex h-30 items-center border-b border-line-subtle last:border-b-0 hover:bg-surface-sunken"
    >
      <span className="w-65 shrink-0 truncate px-6 font-mono text-meta leading-close tabular-nums text-ink-muted">
        {row.order_ref}
      </span>

      <span className="flex min-w-0 flex-1 flex-col px-6">
        <span className="truncate text-body font-semibold leading-close text-ink-primary">
          {row.addr}
        </span>
        <span className="truncate text-label leading-flat text-ink-disabled">{row.place}</span>
      </span>

      <span className="w-85 shrink-0 truncate px-6 text-meta leading-close text-ink-faint">
        {row.client}
      </span>

      {/* The server's own stage word, not a second label table. */}
      <span className="w-55 shrink-0 truncate px-6 text-meta leading-close text-ink-faint">
        {row.stage}
      </span>

      <span className="w-60 shrink-0 truncate px-6 text-meta leading-close text-ink-secondary">
        {row.assigned_to ?? "Unassigned"}
      </span>

      {/* INVARIANT 23: the server's own due label, never a countdown from it. */}
      <span className="w-65 shrink-0 truncate px-6 text-right font-mono text-meta leading-close text-ink-secondary">
        {row.due ?? "No due date"}
      </span>

      <span className="flex w-60 shrink-0 justify-end px-6">
        <span
          aria-hidden
          className="inline-flex h-14 items-center rounded-lg border border-action-border bg-action-surface px-6 text-label font-semibold leading-flat text-ink-secondary"
        >
          Open →
        </span>
      </span>
    </Link>
  );
}
