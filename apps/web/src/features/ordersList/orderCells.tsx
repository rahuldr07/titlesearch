import type { OrderRow } from "@titlepipe/contract";

/**
 * Rule 6, spent once: the row's single status signal is the weight of the
 * address — live orders in primary ink at semibold, delivered ones dropped to
 * secondary. No capsule, no tinted ref, no coloured due date. The stage is
 * stated in words beside it, so the weight is never the only carrier.
 */
export function Address({ row }: { readonly row: OrderRow }) {
  const live = row.stage !== "delivered";
  return (
    <span className="flex min-w-0 flex-col justify-center">
      <span
        className={
          live
            ? "truncate text-body leading-close font-semibold text-ink-primary"
            : "truncate text-body leading-close text-ink-secondary"
        }
      >
        {row.addr}
      </span>
      {/* The county and state sit UNDER the address, as the design draws them:
          beside it they read as one run of one sentence. */}
      <span className="truncate text-label leading-flat text-ink-faint">{row.place}</span>
    </span>
  );
}

/** Rule 14: absence is typed, never a blank cell. */
export function Absent({ children }: { readonly children: string }) {
  return <span className="text-meta leading-close text-ink-faint">{children}</span>;
}
