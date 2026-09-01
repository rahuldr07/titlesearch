/**
 * Where a rail door goes, and whether it is the one on screen. Its own module
 * for the reason `stageIsCurrent.ts` is: `RailSection.tsx` exports a component
 * and Fast Refresh cannot hot-swap a module that also exports plain functions.
 */

/**
 * `/orders` is order-scoped and cannot be entered without an id — linked bare
 * it drops the order you are in and lands on the not-built card, so it carries
 * one whenever one is known.
 */
export function doorHref(path: string, orderId: string | null): string {
  return path === "/orders" && orderId !== null ? `/orders/${orderId}` : path;
}

/**
 * `/` matches exactly. `/orders` matches only the hub itself, never
 * `/orders/:id/review` — the stage rows own the screens beneath it, and two
 * rows claiming "you are here" is one too many. Every other door matches its
 * prefix, which is what the authz path means.
 */
export function doorIsActive(path: string, pathname: string): boolean {
  if (path === "/") return pathname === "/";
  if (path === "/orders") return /^\/orders(\/[^/]+)?$/.test(pathname);
  return pathname.startsWith(path);
}
