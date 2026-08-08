import { expect, test } from "@playwright/test";

/**
 * THE REGRESSION CONTROL, and the only place the "mock mode gets NO proxy" rule
 * is checked at all.
 *
 * `pnpm test:e2e` already covers the UNSET case — its 118 tests build with no
 * `VITE_API_MODE` at all. This covers the value written out explicitly, which
 * is a different code path through `resolveApiMode` and the one CI and a
 * developer will actually type.
 */
test("VITE_API_MODE=mock still serves the rulebook from MSW", async ({ page }) => {
  await page.goto("/rulebook");

  await expect(page.getByTestId("rule-row-R13")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

/**
 * THE THIRD HOLE, closed.
 *
 * `vite.config.ts` builds the `/api` proxy only under `live`, and its stated
 * reason is that a worker which failed to register must not let an `/api` call
 * reach a real backend by accident. Nothing checked it. MEASURED: making that
 * proxy unconditional — mock mode forwarding straight to core-api — left every
 * other assertion in this directory green. Ungating MSW fails two of them and
 * removing the proxy entirely fails one; removing the proxy's MODE GATE failed
 * none at all.
 *
 * This server's `VITE_API_PROXY_TARGET` is aimed at the SAME live core-api the
 * positive control uses (see playwright.live.config.ts), and that is what makes
 * the assertion mean anything: the request is not staying local because there
 * is nowhere to go, it is staying local because mock mode configures no proxy.
 *
 * The path is one MSW does not handle, so `onUnhandledRequest: "bypass"` lets it
 * through to whatever the origin really is. MEASURED, the two answers are not
 * remotely alike:
 *
 *   no proxy (correct)   200, `content-type: text/html` — the SPA fallback —
 *                        and NO `x-request-id`
 *   proxy (the defect)   404, core-api's JSON error envelope, and an
 *                        `x-request-id` stamped by its middleware
 *
 * THE REQUEST SENDS NO `accept` OVERRIDE, and that is load-bearing rather than
 * an omission. Vite's SPA fallback is content-negotiated. Measured on this
 * server, the wildcard accept a plain browser fetch sends — and `text/html` —
 * both return the 200 above, while `application/json` returns a bare 404. That
 * last one is the same STATUS core-api gives, which would leave this test
 * resting on the header alone; the default is the spelling that produces an
 * answer core-api cannot imitate.
 */
test("an /api call MSW does not handle stays on the preview server", async ({
  page,
}) => {
  await page.goto("/rulebook");

  const answer = await page.evaluate(async () => {
    const response = await fetch("/api/__not-an-endpoint__");
    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      requestId: response.headers.get("x-request-id"),
    };
  });

  // core-api's fingerprint, absent. On its own this is a denial, and would pass
  // just as well against a browser that could not fetch anything at all.
  expect(
    answer.requestId,
    "an x-request-id here means mock mode reached core-api",
  ).toBeNull();

  // So the preview server's OWN answer is required too: it serves index.html for
  // any unmatched path, which is a thing only this server does.
  expect(answer.status).toBe(200);
  expect(answer.contentType).toContain("text/html");
});
