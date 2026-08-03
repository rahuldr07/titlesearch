import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { screenOrderFor } from "./flowOrders";
import { chromeFor } from "./chromeFor";
import { useTheme } from "./preferences";
import { orderContextQuery } from "./orderQueries";
import { AccountMenu } from "./AccountMenu";
import { OrderCounts } from "./OrderCounts";
import { Stamp } from "../shared/ui/Stamp";
import { Eyebrow } from "../shared/ui/Eyebrow";

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
 * IT NAMES THE ORDER THE RAIL IS DRAWING, and that is why it resolves through
 * `screenOrderFor` rather than the URL alone. The four flow routes carry no
 * order in the path, so the rail's group header said THIS ORDER over six stages
 * while this strip said "TitlePipe" beside it — the screen declining to name
 * the order it was entirely about. One resolver, two readers, one answer.
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
  const orderId = fetches ? screenOrderFor(pathname) : null;
  // Own `useTheme` call — dedupes with `AppChrome`'s by shared query key, so
  // this is not a second network request, just a second subscriber.
  const [theme, toggleTheme] = useTheme(fetches);
  // `orderQueries.ts` holds the query — the rail's flow header prints the same
  // ref off the same key, so this is a second subscriber, not a second request.
  const { data: context } = useQuery({
    ...orderContextQuery(orderId ?? ""),
    enabled: orderId !== null,
  });

  if (!chrome) return null;

  return (
    /*
     * THE MOCKUP'S `.rstrip`, metric for metric: `gap:18px`, `padding:13px 28px`,
     * one hairline underneath. The strip was on `18px 8px` with a `justify-
     * between` three-way split, which pushed the census to the far right of a
     * 1600px window — 900px from the order it counts. The drawing reads left to
     * right as one sentence: WHICH order · WHAT is in it · then, after the
     * spacer, WHERE it stands and WHO is holding it.
     */
    <div
      data-testid="order-strip"
      className="flex items-center gap-9 border-b border-line-strong bg-surface-panel px-14 py-6.5"
    >
      <div className="min-w-0">
        {orderId === null ? (
          <Eyebrow variant="section">TitlePipe</Eyebrow>
        ) : context === undefined ? null : (
          <span className="font-mono text-lg font-semibold text-ink-primary">
            ORDER {context.order_ref}
          </span>
        )}
      </div>

      {orderId === null ? null : (
        <>
          <StripDivider />
          <OrderCounts orderId={orderId} />
        </>
      )}

      {/* The spacer is the mockup's `.spacer`, and it is why identity sits hard
          right on EVERY screen — including the ones with no order, where the
          left slot is the brand word alone. */}
      <span className="flex-1" />

      {context === undefined || orderId === null ? null : (
        <>
          <Stamp tone={context.stamp.tone} size="sm">
            {context.stamp.label}
          </Stamp>
          <StripDivider />
        </>
      )}

      <AccountMenu theme={theme} onToggleTheme={toggleTheme} />
    </div>
  );
}

/** `.rstrip .div` — a 16px hairline between the strip's three statements. */
function StripDivider() {
  return <span aria-hidden className="h-8 w-px shrink-0 bg-line-strong" />;
}
