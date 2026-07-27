import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/errors.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

import { interceptApi } from "../helpers/net";
// TODO(rebuild) [ORPHAN RULE] — rule: an unknown route renders a named not-found state, never a blank page.
test("an unknown route renders the not-found card, never a blank page", async ({
  page,
}) => {
  await page.goto("/no-such-door");
  const card = page.getByTestId("not-found");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Nothing lives at this address.");
});

// TODO(rebuild) [ORPHAN RULE] — rule: a failed list query renders a named unavailable state.
test("the escalation inbox says unavailable when the list 500s", async ({
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

// TODO(rebuild) [ORPHAN RULE] — rule: a failed deliveries query renders a named unavailable state.
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

// TODO(rebuild) [ORPHAN RULE] — rule: a partial failure degrades that region only — the order spine still renders its identity.
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

// TODO(rebuild) [ORPHAN RULE] — rule: an unknown order renders the empty state, never a working-looking grid.
test.skip("reconciliation with an unknown order shows the empty state, not a working grid", async ({
  page,
}) => {
  await page.goto("/reconciliation/ord_nope");
  await expect(page.getByTestId("recon-empty")).toBeVisible();
  await expect(page.getByText("DIVERGENCES OPEN")).toHaveCount(0);
});

// TODO(rebuild) [ORPHAN RULE] — rule: a stale deep link names itself as stale and is distinguished from the no-context state.
test("seed correction with a stale fieldId names the stale link", async ({
  page,
}) => {
  await page.goto("/seed-correction?fieldId=gf_nope");
  const card = page.getByTestId("stale-link");
  await expect(card).toBeVisible();
  await expect(card).toContainText("gf_nope");
  await expect(page.getByTestId("no-context")).toHaveCount(0);
});

// TODO(rebuild) [ORPHAN RULE] — rule: a failed mutation surfaces the server's message verbatim.
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
