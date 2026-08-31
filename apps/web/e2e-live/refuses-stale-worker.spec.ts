import { expect, test } from "@playwright/test";

/**
 * The mismatch a rebuild does not clear: whether MSW starts is decided at
 * build time, but whether a worker is registered is a fact about the
 * browser, and it survives every rebuild — `mockServiceWorker.js` ships in
 * the live bundle too, so a stale registration still answers. The operator
 * would read mock rows off a server they believe is live, and nothing in
 * the build can see it. The sequence below: load the live app once (clean,
 * so it boots), register the worker the mock build would have registered,
 * reload.
 */
test("live mode refuses to start when a mock worker is still registered", async ({
  page,
}) => {
  await page.goto("/rulebook");
  // A clean live load must NOT refuse, or the assertion below would pass
  // for the wrong reason — this is what makes the refusal specific to the
  // worker. The clean load renders rows and no alert of any kind: a
  // baseline that fails if the live path breaks for any reason at all.
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
