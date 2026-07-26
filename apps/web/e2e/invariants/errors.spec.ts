/*
 * HARVESTED INVARIANT SPECS — migrated by Pass 1 (2026-07-26).
 *
 * Every test here asserts a PRODUCT RULE, not the old UI's DOM. They were all
 * green immediately before migration (116/116). They are skipped, not deleted:
 * un-skip each one as the rebuilt feature reaches it, rewriting SELECTORS only.
 *
 * NEVER weaken an assertion to make it pass. If an invariant cannot pass
 * against the new design, that is a CONFLICT in the design — stop and report.
 *
 * Classification + the rule each protects: docs/frontend/test-harvest.md
 */

import { expect, test } from "@playwright/test";
import { interceptApi } from "../helpers/net";

/**
 * Edge-state hardening: a wrong address, a failed query, a failed mutation,
 * a stale deep link — every one gets a coherent, named state. Blank pages
 * and silent no-ops are the defects these tests pin shut.
 */

// TODO(rebuild): un-skip when this feature lands — rule: an unknown route renders the not-found card, never a blank page
test("an unknown route renders the not-found card, never a blank page", async ({
  page,
}) => {
  await page.goto("/no-such-door");
  const card = page.getByTestId("not-found");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Nothing lives at this address.");
});

// TODO(rebuild): depends on a screen deleted in Pass 1 (/escalations) or on the order rail, not yet rebuilt
test.skip("the escalation inbox says unavailable when the list 500s", async ({
  page,
}) => {
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

// TODO(rebuild): un-skip when this feature lands — rule: delivery says unavailable when deliveries 500s
test("delivery says unavailable when deliveries 500s", async ({ page }) => {
  await interceptApi(page, {
    method: "GET",
    match: "/api/deliveries",
    status: 500,
    body: { error: "boom" },
  });
  await page.goto("/delivery");
  await expect(page.getByText(/Deliveries unavailable/)).toBeVisible({
    timeout: 20_000,
  });
});

// TODO(rebuild): depends on a screen deleted in Pass 1 (/escalations) or on the order rail, not yet rebuilt
test.skip("the order spine survives a timeline failure", async ({ page }) => {
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

// TODO(rebuild): un-skip when this feature lands — rule: reconciliation with an unknown order shows the empty state, not a working grid
test("reconciliation with an unknown order shows the empty state, not a working grid", async ({
  page,
}) => {
  await page.goto("/reconciliation/ord_nope");
  await expect(page.getByTestId("recon-empty")).toBeVisible();
  await expect(page.getByText("DIVERGENCES OPEN")).toHaveCount(0);
});

// TODO(rebuild): un-skip when this feature lands — rule: seed correction with a stale fieldId names the stale link
test("seed correction with a stale fieldId names the stale link", async ({
  page,
}) => {
  await page.goto("/seed-correction?fieldId=gf_nope");
  const card = page.getByTestId("stale-link");
  await expect(card).toBeVisible();
  await expect(card).toContainText("gf_nope");
  await expect(page.getByTestId("no-context")).toHaveCount(0);
});

// TODO(rebuild): un-skip when this feature lands — rule: a delivery retry failure surfaces the server's message
test("a delivery retry failure surfaces the server's message", async ({
  page,
}) => {
  await interceptApi(page, {
    method: "POST",
    match: "/retry",
    status: 500,
    body: { error: "smtp refused" },
  });
  await page.goto("/delivery");
  await page.getByTestId("retry-btn").click();
  await expect(page.getByTestId("retry-note")).toContainText(
    "server: smtp refused",
  );
});
