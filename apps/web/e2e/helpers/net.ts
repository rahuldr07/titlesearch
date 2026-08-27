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
}

export async function trackApi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: { method: string; url: string }[] = [];
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
      log.push({ method, url });
      return orig(input, init);
    };
  });
}

export async function apiLog(page: Page): Promise<ApiCall[]> {
  return page.evaluate(
    () => (window as unknown as { __apiLog?: ApiCall[] }).__apiLog ?? [],
  );
}
