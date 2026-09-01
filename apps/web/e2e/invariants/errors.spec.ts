import { expect, test } from "@playwright/test";

/**
 * Never weaken an assertion — a test that cannot pass against the new
 * design is a conflict in the design: stop and report.
 */

import { interceptApi } from "../helpers/net";
// Rule (recorded nowhere else): an unknown route renders a named not-found state, never a blank page.
test("an unknown route renders the not-found card, never a blank page", async ({
  page,
}) => {
  await page.goto("/no-such-door");
  const card = page.getByTestId("not-found");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Nothing lives at this address.");
});

// Rule (recorded nowhere else): a failed list query renders a named unavailable state.
test("the escalation inbox says unavailable when the list 500s", async ({ page }) => {
  await interceptApi(page, {
    method: "GET",
    match: "/api/escalations",
    status: 500,
    body: { error: "boom" },
  });
  await page.goto("/escalations");
  // TanStack Query retries a failing query 3× with backoff (~7s) before the
  // error surfaces — the wait must outlast the retry ladder.
  await expect(page.getByText(/Inbox unavailable/)).toBeVisible({
    timeout: 20_000,
  });
});

// Rule (recorded nowhere else): a partial failure degrades that region only.
// Asserted on the hub, which is where the timeline is read now — the Review
// screen's order spine was removed 2026-09-01 (it drew a third copy of the
// order's identity and an event log the hub already carries, 128px above the
// fold on the densest screen in the product).
test("a timeline failure degrades the event trail only", async ({ page }) => {
  await interceptApi(page, {
    method: "GET",
    match: "/timeline",
    status: 500,
    body: { error: "boom" },
  });
  await page.goto("/orders/ord_demo_1");
  // The verdict is a different read, so it must still render.
  await expect(page.getByTestId("order-ref")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("The server has not sent this order's thread.")).toBeVisible();
});
