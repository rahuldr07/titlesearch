/**
 * The order in view, taken from the URL. Null on screens that have no order.
 *
 * THE ORDER COMES FROM THE URL, never a remembered "current order" — two tabs
 * on two orders is a normal way to work. `AppChrome` and `OrderStrip` are two
 * independent top-level components that both need this fact on every render;
 * sharing the one regex here keeps them from drifting rather than forcing one
 * to reach into the other (they are siblings in `rootRoute`, not parent/child).
 */
export function orderFromPath(pathname: string): string | null {
  return /^\/orders\/([^/]+)\//.exec(pathname)?.[1] ?? null;
}
