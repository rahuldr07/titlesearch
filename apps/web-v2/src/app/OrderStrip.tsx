import { queryOptions, useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { OrderSignoffResponse } from "@titlepipe/contract";
import { get } from "../shared/api";
import { orderFromPath } from "./orderFromPath";
import { useTheme } from "./preferences";
import { AccountMenu } from "./AccountMenu";
import { OrderCounts } from "./OrderCounts";
import { Stamp } from "../shared/ui/Stamp";
import { Eyebrow } from "../shared/ui/Eyebrow";

/**
 * Same duplication convention `features/review/queries.ts` documents for its
 * own copy of this query: `app/` is not a feature, but the shape and the URL
 * are the same one contract schema parses, so a second small wrapper beats
 * reaching into a feature's internals for one query.
 */
function signoffQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "signoff"],
    queryFn: () => get(`/api/orders/${orderId}/signoff`, OrderSignoffResponse),
  });
}

/**
 * The full-width top bar (§11 2026-07-30 revision) — `AppChrome`'s sibling in
 * `rootRoute`, not its child, so it reads the URL and the preference on its
 * own rather than being handed them. It replaces what used to sit in the
 * sidebar foot: the order's counts and the account menu.
 *
 * CONTRACT GAP: the design's left label is `ORDER {order_ref}`, the
 * human-readable reference (e.g. "4176034-1"). No endpoint scoped by the URL
 * order id returns that ref — `LifecycleOrder.order_ref` exists only in the
 * census list and carries no id to join back on (`OrderCard.tsx`'s own gap
 * note), and `Order.external_ref` comes only from `/api/queue/next`, not from
 * an id lookup. What IS available and citable here is the URL id itself,
 * which `OrderFieldsResponse.order_id` echoes back — so that is what renders.
 *
 * CONTRACT GAP: the design's stamp reads an exact word like `SIGN-OFF OPEN`.
 * `OrderSignoffResponse` carries no lifecycle-label field, only `signed_by` /
 * `signed_at` (both null until a person signs — `intake.ts`). Composing the
 * design's exact word from that would be inventing client-side lifecycle text
 * hard rule 9 forbids; the strip instead states the two facts the contract
 * actually distinguishes, same wording `OrderIdentityStrip` already uses for
 * the same null check.
 *
 * NO ORDER, NO FABRICATION: off an order screen this shows identity and a
 * brand-neutral left, never an invented order.
 */
export function OrderStrip() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onCaptureSeat = pathname.startsWith("/blind");
  const orderId = orderFromPath(pathname);
  // Own `useTheme` call — dedupes with `AppChrome`'s by shared query key, so
  // this is not a second network request, just a second subscriber.
  const [theme, toggleTheme] = useTheme(!onCaptureSeat);
  const { data: signoff } = useQuery({
    ...signoffQuery(orderId ?? ""),
    enabled: orderId !== null,
  });

  if (onCaptureSeat) return null;

  const stamp =
    signoff === undefined
      ? null
      : signoff.signed_by === null
        ? { label: "Not signed", tone: "attend" as const }
        : { label: `Signed · ${signoff.signed_by}`, tone: "settled" as const };

  return (
    <div
      data-testid="order-strip"
      className="flex items-center justify-between gap-6 border-b border-line-strong bg-surface-panel px-9 py-4"
    >
      <div className="min-w-0">
        {orderId === null ? (
          <Eyebrow variant="section">TitlePipe</Eyebrow>
        ) : (
          <span className="font-mono text-md font-semibold text-ink-primary">
            ORDER {orderId}
          </span>
        )}
      </div>

      {orderId === null ? null : (
        <div className="flex flex-1 items-center justify-end gap-6">
          <OrderCounts orderId={orderId} />
          {stamp === null ? null : (
            <Stamp tone={stamp.tone} size="sm">
              {stamp.label}
            </Stamp>
          )}
        </div>
      )}

      <AccountMenu theme={theme} onToggleTheme={toggleTheme} />
    </div>
  );
}
