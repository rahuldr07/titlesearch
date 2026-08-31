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

// Rule (recorded nowhere else): a partial failure degrades that region only — the order spine still renders its identity.
test("the order spine survives a timeline failure", async ({ page }) => {
  await interceptApi(page, {
    method: "GET",
    match: "/timeline",
    status: 500,
    body: { error: "boom" },
  });
  await page.goto("/orders/ord_demo_1/review");
  const rail = page.getByTestId("order-rail");
  await expect(rail).toContainText("ord_demo_1");
  await expect(rail).toContainText("timeline unavailable", {
    timeout: 20_000,
  });
});
