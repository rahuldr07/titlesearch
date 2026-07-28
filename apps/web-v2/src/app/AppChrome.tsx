import { Link, useRouterState } from "@tanstack/react-router";
import { ScreenMenu } from "./ScreenMenu";
import { OrderCounts } from "./OrderCounts";
import { AccountMenu } from "./AccountMenu";
import { useNavCollapsed } from "./preferences";
import { Eyebrow } from "../shared/ui/Eyebrow";

/** The order in view, taken from the URL. Null on screens that have no order. */
function orderFromPath(pathname: string): string | null {
  return /^\/orders\/([^/]+)\//.exec(pathname)?.[1] ?? null;
}

/**
 * The top chrome — wordmark, order, screen menu, order counts, identity.
 *
 * IT IS ABSENT ON THE CAPTURE SEAT, and that is structural rather than
 * cosmetic. A typist doing a blind pass must not see the pipeline's world: the
 * menu names screens that would tell them what the machine already thinks, and
 * the counts describe an order they are supposed to be reading cold. Removing
 * the chrome there is the same rule that kills the keyboard layer on `/blind/*`.
 *
 * THE ORDER COMES FROM THE URL, never from a "current order" the client
 * remembers. Two tabs on two orders is a normal way to work, and a remembered
 * order would put one tab's counts above the other tab's document.
 */
export function AppChrome() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onCaptureSeat = pathname.startsWith("/blind");
  const [collapsed, toggleCollapsed] = useNavCollapsed(!onCaptureSeat);
  if (onCaptureSeat) return null;

  const orderId = orderFromPath(pathname);

  return (
    <header className="sticky top-0 z-(--z-popup) flex min-h-18 flex-wrap items-center gap-x-6 gap-y-2 border-b border-line-strong bg-surface-panel px-6 py-2">
      <Link to="/" className="flex shrink-0 items-center gap-4">
        <span aria-hidden className="flex size-8 flex-col justify-center gap-1 rounded-2 border-2 border-action px-1">
          <span className="h-0.5 rounded-pill bg-action" />
          <span className="h-0.5 w-3/4 rounded-pill bg-action" />
          <span className="h-0.5 rounded-pill bg-action" />
        </span>
        <span>
          <span className="block text-sm font-bold tracking-stamp text-ink-primary">TITLEPIPE</span>
          <Eyebrow variant="caption">Abstractor Review</Eyebrow>
        </span>
      </Link>

      {orderId === null ? null : (
        <>
          <span aria-hidden className="h-8 w-px shrink-0 bg-line-strong" />
          <span className="shrink-0">
            <Eyebrow variant="caption">Order</Eyebrow>
            <span data-testid="chrome-order" className="block font-mono text-xs text-ink-primary">
              {orderId}
            </span>
          </span>
        </>
      )}

      <button
        type="button"
        data-testid="rail-toggle"
        aria-pressed={collapsed}
        aria-label={collapsed ? "Expand the navigator" : "Fold the navigator"}
        onClick={toggleCollapsed}
        className="shrink-0 rounded-3 border border-line-strong px-3 py-2 font-mono text-micro text-ink-secondary"
      >
        [
      </button>

      <ScreenMenu orderId={orderId} collapsed={collapsed} />

      <div className="flex shrink-0 items-center gap-6">
        {orderId === null ? null : <OrderCounts orderId={orderId} />}
        <AccountMenu />
      </div>
    </header>
  );
}
