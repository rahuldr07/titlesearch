import { expect, test } from "@playwright/test";

/**
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/review-conflict.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

import { interceptApi } from "../helpers/net";
// TODO(rebuild) [INVARIANT] — rule: a 409 is an ANSWER, not a dead no-op: the server's message surfaces verbatim, selection never advances, and the field repaints as the server has it.
test("confirm 409 (different value) surfaces the server's message and never advances", async ({
  page,
}) => {
  await interceptApi(page, {
    method: "POST",
    match: "/confirm",
    status: 409,
    body: { error: "already confirmed with a different value" },
  });
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  // confirm is `c` now (C confirm · E correct), not ⏎
  await page.keyboard.press("c");
  await expect(page.getByTestId("confirm-note")).toContainText(
    "already confirmed with a different value",
  );
  // no advance — the reviewer stays on the refused field
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  // server truth repainted: the un-mutated store still says needs_review
  await expect(page.getByTestId("row-owner.zip").getByTestId("row-mark")).toHaveCount(
    0,
  );
});

// TODO(rebuild) [INVARIANT] — rule: a terminal-state 409 is answered the same way — surfaced, not swallowed.
test("confirm 409 (terminal state) is answered, not a dead no-op", async ({ page }) => {
  await interceptApi(page, {
    method: "POST",
    match: "/confirm",
    status: 409,
    body: { error: "field is terminal (corrected)" },
  });
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  // confirm is `c` now (C confirm · E correct), not ⏎
  await page.keyboard.press("c");
  await expect(page.getByTestId("confirm-note")).toContainText(
    "field is terminal (corrected)",
  );
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
});

// TODO(rebuild) [INVARIANT] — rule: confirm is idempotent on an identical value (200/200) and conflicts on a different one (409).
test("bug-5 mock semantics hold: same value 200/200, different value 409", async ({
  page,
}) => {
  // no interception — this pins the MSW contract the UI now depends on
  await page.goto("/orders/ord_demo_1/review");
  await expect(page.getByTestId("sel-label")).toHaveText("OWNER ZIP");
  const statuses = await page.evaluate(async () => {
    const post = (value: string) =>
      fetch("/api/fields/fld_zip/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      }).then((r) => r.status);
    const first = await post("30296");
    const sameAgain = await post("30296"); // idempotent resubmit
    const different = await post("99999"); // conflicting value
    return { first, sameAgain, different };
  });
  expect(statuses.first).toBe(200);
  expect(statuses.sameAgain).toBe(200);
  expect(statuses.different).toBe(409);
});
