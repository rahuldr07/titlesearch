import type { Page } from "@playwright/test";

/**
 * MSW-proof network helpers. `page.route` CANNOT see requests the MSW service
 * worker answers (SW-handled fetches bypass Playwright routing entirely), so
 * forcing errors and counting calls both happen IN-PAGE: an init-script fetch
 * wrapper installed before the app loads. A synthetic Response returned here
 * never reaches the SW; everything else passes through to MSW untouched.
 *
 * Both helpers MUST be called before `page.goto`.
 */

export async function interceptApi(
  page: Page,
  opts: { method: string; match: string; status: number; body: unknown },
): Promise<void> {
  await page.addInitScript((o) => {
    const orig = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      if (method === o.method.toUpperCase() && url.includes(o.match)) {
        return new Response(JSON.stringify(o.body), {
          status: o.status,
          headers: { "content-type": "application/json" },
        });
      }
      return orig(input, init);
    };
  }, opts);
}

export interface ApiCall {
  method: string;
  url: string;
  /**
   * The request body verbatim, for the calls that carry one; `null` where
   * there was none. A log of method and URL alone cannot tell a correction
   * that carried a reason from one that did not — same verb, same URL, and
   * the whole difference is in here.
   */
  body: string | null;
}

export async function trackApi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: { method: string; url: string; body: string | null }[] = [];
    (window as unknown as { __apiLog: typeof log }).__apiLog = log;
    const orig = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      /* Only a string body is read. A `Request`, a `FormData` or a stream
         would each have to be cloned or consumed, and consuming it here is
         what would break the very call being logged; this app posts JSON
         strings (`shared/api.ts`), so anything else records as `null`
         rather than as a body this helper invented. */
      const body = typeof init?.body === "string" ? init.body : null;
      log.push({ method, url, body });
      return orig(input, init);
    };
  });
}

export async function apiLog(page: Page): Promise<ApiCall[]> {
  return page.evaluate(
    () => (window as unknown as { __apiLog?: ApiCall[] }).__apiLog ?? [],
  );
}
