/**
 * Which surfaces get the chrome, and which get to issue requests.
 *
 * TWO BOOLEANS, NOT ONE, because "draw no chrome" and "make no requests" are
 * different claims and conflating them is what shipped the bug this replaces:
 * `AppChrome` and `OrderStrip` each gated on `/blind` alone, so `/signin`
 * rendered the full 232px sidebar with every ADMIN door and a top strip reading
 * "L. Vance · ADMIN" — to somebody who is not signed in. The export gates the
 * whole chrome on `showChrome = !(isSignin || isSession)`.
 *
 * The capture seat needs BOTH refusals for a reason no other screen shares: a
 * typist on a blind pass must not learn what the machine already thinks, and
 * the door labels alone would tell them. The rule is that the seat issues zero
 * `/api` GETs, so every query behind the chrome is disabled there rather than
 * merely unrendered. The network-layer proof of it — harvested as
 * `blind-blindness.spec` #1, which counts calls in-page because Playwright
 * cannot see MSW-served fetches — IS NOT BUILT in this repo; what holds today
 * is `chromeFor.test.ts` below, on the flag every caller reads.
 *
 * `/signin` and `/session` refuse both for a plainer reason: nobody is
 * authenticated, so neither the chrome nor the fetches behind it are
 * legitimate. Same outcome, different rule — which is exactly why the two
 * fields stay separate rather than collapsing into one.
 */
export interface ChromeMode {
  /** Draw the sidebar and the order strip. */
  chrome: boolean;
  /** Issue the preference and attention GETs. */
  fetches: boolean;
}

const CHROMELESS: readonly string[] = ["/signin", "/session"];

export function chromeFor(pathname: string): ChromeMode {
  if (pathname.startsWith("/blind")) return { chrome: false, fetches: false };
  if (CHROMELESS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return { chrome: false, fetches: false };
  }
  return { chrome: true, fetches: true };
}
