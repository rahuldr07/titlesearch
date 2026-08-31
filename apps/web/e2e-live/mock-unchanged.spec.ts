import { expect, test } from "@playwright/test";

/**
 * The regression control, and the only place the "mock mode gets no proxy"
 * rule is checked at all. `pnpm test:e2e` covers the unset case; this
 * covers the value written out explicitly — a different code path through
 * `resolveApiMode` and the one CI and a developer will actually type.
 */
test("VITE_API_MODE=mock still serves the rulebook from MSW", async ({ page }) => {
  await page.goto("/rulebook");

  await expect(page.getByTestId("rule-row-R13")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

/**
 * `vite.config.ts` builds the `/api` proxy only under `live`: a worker
 * that failed to register must not let an `/api` call reach a real backend
 * by accident. This server's `VITE_API_PROXY_TARGET` is aimed at the same
 * live core-api the positive control uses (see playwright.live.config.ts),
 * which is what makes the assertion mean anything: the request stays local
 * because mock mode configures no proxy, not because there is nowhere to
 * go. The path is one MSW does not handle, so `onUnhandledRequest:
 * "bypass"` lets it through, and the two answers are not alike:
 *
 *   no proxy (correct)   200, `content-type: text/html` — the SPA fallback —
 *                        and no `x-request-id`
 *   proxy (the defect)   404, core-api's JSON error envelope, and an
 *                        `x-request-id` stamped by its middleware
 *
 * The request sends no `accept` override, and that is load-bearing: Vite's
 * SPA fallback is content-negotiated, and `application/json` returns a
 * bare 404 — the same status core-api gives. The default accept is the
 * spelling that produces an answer core-api cannot imitate.
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
