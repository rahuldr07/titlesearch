import { expect, test } from "@playwright/test";

/**
 * Authorization invariants. Never weaken an assertion — a test that cannot
 * pass against the new design is a conflict in the design: stop and report.
 */

// Rule: the role gate runs BEFORE validation — a role that lacks the action gets 403 even with an invalid body.
test("the mock server refuses a mutation the role doesn't hold — before validation", async ({
  page,
}) => {
  await page.goto("/escalations");
  // an MSW-served element proves the worker controls the page before we fetch
  await expect(page.getByTestId("escalation-esc_party_1")).toBeVisible();
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

// Rule: one permission table gates UI affordances and server mutations alike — they cannot drift.
test("a senior may resolve; an ops role may not — same endpoint, same table", async ({
  page,
}) => {
  await page.goto("/escalations");
  await expect(page.getByTestId("escalation-esc_party_1")).toBeVisible();
  const status = await page.evaluate(() =>
    fetch("/api/escalations/esc_party_1/resolve", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-role": "ops" },
      body: JSON.stringify({}),
    }).then((r) => r.status),
  );
  expect(status).toBe(403);
});

/**
 * Role-gating for the QC determination: on the escalations surface a non-QC
 * seat sees the determination visible + disabled with the "belongs to QC"
 * hint. The refusal coverage is not weakened — the wire half asserts the
 * server still 403s a reviewer's resolve; the dimmed button is a courtesy,
 * the table is the enforcement.
 */
test("the QC determination: enabled for a holder, dimmed-with-reason for a non-holder, 403 on the wire", async ({
  page,
}) => {
  await page.goto("/escalations");
  // admin (dev default) holds escalation.resolve — the live card renders
  await expect(page.getByTestId("resolve-card")).toBeVisible();
  await expect(page.getByTestId("resolve-btn-locked")).toHaveCount(0);

  // the wire refuses a reviewer regardless of what any screen draws
  const status = await page.evaluate(() =>
    fetch("/api/escalations/esc_party_1/resolve", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-role": "reviewer" },
      body: JSON.stringify({}),
    }).then((r) => r.status),
  );
  expect(status).toBe(403);

  // switch seats in-page (no reload — the demo session store re-boots on one)
  await page.getByTestId("sign-out").click();
  await page.getByTestId("continue-as-reviewer").click();
  // Continue-as lands on "/" — walk BACK to /escalations through SPA history
  // (a page.goto would reload and re-boot the session store to admin).
  await page.goBack();

  // drawn: visible + disabled, carrying its reason
  const locked = page.getByTestId("resolve-btn-locked");
  await expect(locked).toBeVisible();
  await expect(locked).toBeDisabled();
  await expect(locked).toHaveAttribute("data-disabled-reason", /belongs to QC/);
  await expect(page.getByTestId("resolve-card")).toHaveCount(0);
});
