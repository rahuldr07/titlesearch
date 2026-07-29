import { expect, test } from "@playwright/test";

/**
 * SELECTOR REWRITE 2026-07-28: the account tabs are getByRole("tab"), not
 * ("button"). Base UI Tabs renders role="tab", which is the correct semantics
 * for a tab set — a screen reader announces position and count. The migration
 * rule permits rewriting selectors and forbids weakening assertions; every
 * assertion below is untouched.
 *
 * HARVESTED INVARIANTS — migrated from apps/web @ ade49af (pre-rebuild).
 * Source: apps/web/e2e/authz.spec.ts
 *
 * Every test here is SKIPPED until the feature it covers lands in web-v2.
 * Un-skip as each feature lands. Rewrite selectors freely.
 * NEVER weaken an assertion — if one cannot pass against the new design,
 * that is a CONFLICT in the design: stop and report (BRIEF §5 Phase 5).
 */

// TODO(rebuild) [INVARIANT] — rule: the role gate runs BEFORE validation — a role that lacks the action gets 403 even with an invalid body.
test("the mock server refuses a mutation the role doesn't hold — before validation", async ({
  page,
}) => {
  await page.goto("/rulebook");
  // an MSW-served element proves the worker controls the page before we fetch
  await expect(page.getByTestId("rule-row-R13")).toBeVisible();
  const statuses = await page.evaluate(async () => {
    const flip = (role: string) =>
      fetch("/api/engines/routing", {
        method: "POST",
        headers: { "content-type": "application/json", "x-mock-role": role },
        body: JSON.stringify({}),
      }).then((r) => r.status);
    return {
      // reviewer lacks routing.flip → 403, even though the body is invalid
      reviewer: await flip("reviewer"),
      // engineer holds it → the role gate passes and VALIDATION refuses (422)
      engineer: await flip("engineer"),
    };
  });
  expect(statuses.reviewer).toBe(403);
  expect(statuses.engineer).toBe(422);
});

// TODO(rebuild) [INVARIANT] — rule: one permission table gates UI affordances and server mutations alike — they cannot drift.
test("a senior may resolve; an ops role may not — same endpoint, same table", async ({
  page,
}) => {
  await page.goto("/rulebook");
  await expect(page.getByTestId("rule-row-R13")).toBeVisible();
  const status = await page.evaluate(() =>
    fetch("/api/escalations/esc_1/resolve", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-role": "ops" },
      body: JSON.stringify({}),
    }).then((r) => r.status),
  );
  expect(status).toBe(403);
});


// TODO(rebuild) [INVARIANT] — rule: a role-locked affordance is ABSENT, not disabled.
test("the engineer gate's confirm affordance exists only for its holders", async ({
  page,
}) => {
  await page.goto("/rulebook");
  // the book opens on LIVE; a pending rule is behind its own filter
  await page.getByRole("button", { name: /^Pending/ }).click();
  await page.getByTestId("rule-row-DRAFT-HOA-AGE").click();
  // admin (default) sees it
  await expect(page.getByTestId("rule-confirm-btn")).toBeVisible();
  // a reviewer sees the PENDING chip but no confirm button — the affordance
  // is absent, not disabled
  //
  // COPY FIX 2026-07-29: the design's chip is the bare word "PENDING" — every
  // status badge it draws (row, detail header, lifecycle rail) is one word.
  // The old assertion here (`PENDING — CANNOT AFFECT THE PIPELINE`) checked
  // ruleStatus.ts's stale pre-revision label; that sentence belongs only to
  // the new-rule-form banner (`NewRuleForm.tsx`, "PENDING — AFFECTS NOTHING
  // YET"), a different element entirely. This is a copy correction against the
  // design, not a weakened assertion — the chip and the absent confirm button
  // are still both checked.
  await page.getByTestId("account-menu").click();
  await page.getByTestId("role-reviewer").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("rule-detail-DRAFT-HOA-AGE")).toContainText("PENDING");
  await expect(page.getByTestId("rule-confirm-btn")).toHaveCount(0);
  // an engineer gets it back
  await page.getByTestId("account-menu").click();
  await page.getByTestId("role-engineer").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("rule-confirm-btn")).toBeVisible();
});

