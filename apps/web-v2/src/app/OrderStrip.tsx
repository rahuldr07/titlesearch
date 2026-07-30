import { queryOptions, useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { OrderContextResponse } from "@titlepipe/contract";
import { get } from "../shared/api";
import { orderFromPath } from "./orderFromPath";
import { chromeFor } from "./chromeFor";
import { useTheme } from "./preferences";
import { AccountMenu } from "./AccountMenu";
import { OrderCounts } from "./OrderCounts";
import { Stamp } from "../shared/ui/Stamp";
import { Eyebrow } from "../shared/ui/Eyebrow";

/**
 * THE ORDER-SCOPED LOOKUP THIS STRIP EXISTS TO READ (2026-07-30, Wave 2). It
 * returns the human reference for an order you have only the URL id of, and
 * the SERVER'S OWN lifecycle stamp — label and tone already decided, so no
 * screen composes that word from `signed_by === null` or from anything else.
 */
function contextQuery(orderId: string) {
  return queryOptions({
    queryKey: ["orders", orderId, "context"],
    queryFn: () => get(`/api/orders/${orderId}/context`, OrderContextResponse),
  });
}

/**
 * The full-width top bar (§11 2026-07-30 revision) — `AppChrome`'s sibling in
 * `rootRoute`, not its child, so it reads the URL and the preference on its
 * own rather than being handed them. It replaces what used to sit in the
 * sidebar foot: the order's counts and the account menu.
 *
 * The left label is the design's `ORDER {order_ref}` — the human reference,
 * read from `GET /api/orders/{id}/context`. It is never the URL id: an id is
 * how the app addresses an order, not what anyone calls it, and the two are
 * not interchangeable in a sentence spoken to a client.
 *
 * THE STAMP IS THE SERVER'S WORD, taken whole. `OrderContextResponse.stamp`
 * arrives as `{label, tone}` already decided, so the strip neither composes
 * lifecycle text nor picks a tone for it — hard rule 9, and the reason the
 * strip does not read `signed_by === null` and call the result a state.
 *
 * NO ORDER, NO FABRICATION: off an order screen this shows identity and a
 * brand-neutral left, never an invented order. On an order screen BEFORE the
 * context resolves it shows nothing rather than a placeholder ref — a wrong
 * order number read aloud is worse than a blank that lasts one paint.
 */
export function OrderStrip() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Same predicate as `AppChrome`, read independently rather than passed down —
  // neither gates the other. Gating on `/blind` alone put an identity chip
  // reading "L. Vance · ADMIN" on the sign-in screen.
  const { chrome, fetches } = chromeFor(pathname);
  const orderId = fetches ? orderFromPath(pathname) : null;
  // Own `useTheme` call — dedupes with `AppChrome`'s by shared query key, so
  // this is not a second network request, just a second subscriber.
  const [theme, toggleTheme] = useTheme(fetches);
  const { data: context } = useQuery({
    ...contextQuery(orderId ?? ""),
    enabled: orderId !== null,
  });

  if (!chrome) return null;

  return (
    <div
      data-testid="order-strip"
      className="flex items-center justify-between gap-6 border-b border-line-strong bg-surface-panel px-9 py-4"
    >
      <div className="min-w-0">
        {orderId === null ? (
          <Eyebrow variant="section">TitlePipe</Eyebrow>
        ) : context === undefined ? null : (
          <span className="font-mono text-md font-semibold text-ink-primary">
            ORDER {context.order_ref}
          </span>
        )}
      </div>

      {orderId === null ? null : (
        <div className="flex flex-1 items-center justify-end gap-6">
          <OrderCounts orderId={orderId} />
          {context === undefined ? null : (
            <Stamp tone={context.stamp.tone} size="sm">
              {context.stamp.label}
            </Stamp>
          )}
        </div>
      )}

      <AccountMenu theme={theme} onToggleTheme={toggleTheme} />
    </div>
  );
}
