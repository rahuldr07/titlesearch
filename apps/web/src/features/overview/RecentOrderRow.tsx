import { Link } from "@tanstack/react-router";
import type { OrderRow } from "@titlepipe/contract";
import { buttonVariants, cx } from "../../components/ui";
import { RouteButton } from "../../app/chrome/RouteButton";
import { useOverlays } from "../../app/keyboard/overlays";

/**
 * One browse row over the prototype's seven tracks. Its action cell holds two
 * destinations — the order's history and the workstation — so the history is an
 * anchor laid over the whole row, which keeps the row clickable without nesting
 * one interactive element inside another; the button follows it in the DOM and
 * takes its own clicks.
 *
 * NOT CARRIED: the prototype's tinted ink on a delivered row. The row already
 * prints the server's stage word in its own column, and a second colour-coded
 * encoding of the same fact would be a client-side taxonomy over `OrderStage` —
 * rule 7 keeps state colour closed.
 */
export function RecentOrderRow(props: { readonly row: OrderRow }) {
  const row = props.row;

  return (
    <div
      data-recent-order={row.id}
      className="relative flex h-30 items-center border-b border-line-subtle last:border-b-0 hover:bg-surface-sunken"
    >
      <Link
        to="/orders/$orderId"
        params={{ orderId: row.id }}
        aria-label={`Order ${row.order_ref} — ${row.addr}, ${row.place}`}
        className="tp-state absolute inset-0"
      />

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

      {/* The server's own due label, never a countdown from it — the varied
          strings ("5h 20m", "tomorrow 10:00 AM", "Waiting on QC") arrive
          finished. A delivered row's cell dims, as the reference draws it
          (RULING-2026-08-29) — keyed on the served stage, not on the text. */}
      <span
        className={cx(
          "w-65 shrink-0 truncate px-6 text-right font-mono text-meta leading-close",
          row.stage === "delivered"
            ? "text-ink-disabled"
            : "font-semibold text-ink-secondary",
        )}
      >
        {row.due ?? "No due date"}
      </span>

      {/* The reference's two row actions: the audit-history modal, then Open →.
          Both sit above the row's covering anchor and take their own clicks. */}
      {/* w-85: the cell must hold the clock AND Open →, or it overflows the due column. */}
      <span className="relative flex w-85 shrink-0 items-center justify-end gap-4 px-6">
        <HistoryButton id={row.id} orderRef={row.order_ref} />
        <RouteButton
          size="sm"
          to="/orders/$orderId/review"
          params={{ orderId: row.id }}
          aria-label={`Open the review for order ${row.order_ref}`}
        >
          Open →
        </RouteButton>
      </span>
    </div>
  );
}

/**
 * The row's clock button — `openOrderHistory(row.id)` names the order for the
 * ONE history overlay (`app/keyboard/overlays.ts`). A twin of the button in
 * `features/ordersList/orderColumns.tsx` rather than one shared component:
 * `check-rules` forbids a cross-feature import, and the shared home would be a
 * kit primitive this 15-line affordance has not yet earned. A native
 * `<button>` in the kit's chrome, because react-aria's Button drops `title`
 * and the reference draws this affordance as a tooltip-bearing icon.
 */
function HistoryButton(props: { readonly id: string; readonly orderRef: string }) {
  const openHistory = useOverlays((s) => s.openOrderHistory);
  return (
    <button
      type="button"
      title="Inspect full audit history"
      aria-label={`Inspect the full audit history of order ${props.orderRef}`}
      onClick={() => openHistory(props.id)}
      className={cx(
        buttonVariants({ variant: "secondary", size: "sm", icon: true }),
        "text-ink-muted",
      )}
    >
      {/* The reference's clock glyph, verbatim. */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M12 8v4l3 3" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    </button>
  );
}
