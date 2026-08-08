import { expect, test } from "@playwright/test";

/**
 * THE MISMATCH A REBUILD DOES NOT CLEAR.
 *
 * Whether MSW starts is decided when the bundle is built. Whether a worker is
 * REGISTERED is a fact about the browser, and it survives every rebuild —
 * `mockServiceWorker.js` ships in the live bundle too, so the file the stale
 * registration points at is still there and still answering.
 *
 * `pnpm build && VITE_API_MODE=live pnpm preview` is the ordinary way to reach
 * this: proxy on, worker on, worker wins. The operator reads mock rows off a
 * server they believe is live — the precise failure this whole task exists to
 * make impossible — and nothing in the build can see it, because nothing in the
 * build can see the browser.
 *
 * The sequence below is that sequence: load the live app once (clean, so it
 * boots), register the worker the mock build would have registered, reload.
 */
test("live mode refuses to start when a mock worker is still registered", async ({ page }) => {
  await page.goto("/rulebook");
  // A clean live load must NOT refuse, or the assertion below would pass for
  // the wrong reason — this is what makes the refusal specific to the worker.
  //
  // THIS USED TO ASSERT `Rulebook unavailable.`, which was the same intent said
  // badly: the harness had no database, so the clean load's alert was the
  // rulebook's own 503 halt and "not the WORKER refusal" was the most this line
  // could claim. Task 5 gave the harness a database, so the clean load now
  // renders rows and there is no alert of any kind — a stronger baseline, and
  // one that fails if the live path breaks for any reason at all rather than
  // only if it breaks in a new way.
  await expect(page.getByTestId("rule-row-R13")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/mockServiceWorker.js");
    await navigator.serviceWorker.ready;
  });

  await page.reload();

  await expect(page.getByRole("alert")).toContainText(
    "a mock service worker is still registered",
  );
  // The reader has to be told what to do about it, not merely that it happened.
  await expect(page.getByRole("alert")).toContainText("Unregister");
  // And the app must be REFUSED, not merely warned about.
  await expect(page.getByTestId("rule-row-R13")).toHaveCount(0);
});
