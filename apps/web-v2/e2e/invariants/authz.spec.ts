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
  await page.goto("/account");
  // an MSW-served element proves the worker controls the page before we fetch
  await expect(page.getByTestId("rule-R13")).toBeVisible();
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
  await page.goto("/account");
  await expect(page.getByTestId("rule-R13")).toBeVisible();
  const status = await page.evaluate(() =>
    fetch("/api/escalations/esc_1/resolve", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-role": "ops" },
      body: JSON.stringify({}),
    }).then((r) => r.status),
  );
  expect(status).toBe(403);
});

// TODO(rebuild) [INVARIANT] — rule: the wire serves per-role projections: a typist's payload never NAMES another world, and no holder lists travel.
test("the wire serves per-role projections — a typist's payload never mentions other worlds", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page.getByTestId("rule-R13")).toBeVisible();
  const res = await page.evaluate(() =>
    fetch("/api/me/permissions", {
      headers: { "x-mock-role": "typist" },
    }).then(async (r) => ({ status: r.status, text: await r.text() })),
  );
  expect(res.status).toBe(200);
  const body = JSON.parse(res.text) as {
    role: string;
    rules: { action: string }[];
  };
  expect(body.role).toBe("typist");
  expect(body.rules.map((r) => r.action).sort()).toEqual([
    "blind.submit",
    "screen.account.enter",
    "screen.blind.enter",
  ]);
  // the leak test at the wire: the raw payload must not NAME other worlds
  for (const word of ["escalation", "dashboard", "golden", "routing", "queue"]) {
    expect(res.text).not.toContain(word);
  }
  // and no holder lists travel — clients learn their grants, not who else's
  expect(res.text).not.toContain('"roles"');
});

// TODO(rebuild) [INVARIANT] — rule: the Me tab renders the served world and re-fetches on a role switch — it never computes the world locally.
test("the Me tab renders the served world and re-fetches on role switch", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("tab", { name: "Me" }).click();
  const world = page.getByTestId("my-world");
  // admin's served world names every door
  await expect(world).toContainText("/queue");
  await expect(world).toContainText("/dashboard");
  // switch to typist: the projection shrinks to the capture world
  await page.getByTestId("role-typist").click();
  await expect(world).toContainText("/blind");
  await expect(world).toContainText("blind.submit");
  await expect(world).not.toContainText("/dashboard");
  await expect(world).not.toContainText("escalation");
});

// TODO(rebuild) [INVARIANT] — rule: a role-locked affordance is ABSENT, not disabled.
test("the engineer gate's confirm affordance exists only for its holders", async ({
  page,
}) => {
  await page.goto("/account");
  // admin (default) sees it
  await expect(page.getByTestId("confirm-DRAFT-HOA-AGE")).toBeVisible();
  // a reviewer sees the PENDING chip but no confirm button — the affordance
  // is absent, not disabled
  await page.getByRole("tab", { name: "Me" }).click();
  await page.getByTestId("role-reviewer").click();
  await page.getByRole("tab", { name: "Rulebook" }).click();
  await expect(page.getByTestId("rule-DRAFT-HOA-AGE")).toContainText(
    "PENDING — CANNOT AFFECT THE PIPELINE",
  );
  await expect(page.getByTestId("confirm-DRAFT-HOA-AGE")).toHaveCount(0);
  // an engineer gets it back
  await page.getByRole("tab", { name: "Me" }).click();
  await page.getByTestId("role-engineer").click();
  await page.getByRole("tab", { name: "Rulebook" }).click();
  await expect(page.getByTestId("confirm-DRAFT-HOA-AGE")).toBeVisible();
});

// TODO(rebuild) [INVARIANT] — rule: a non-review role reaching review by deep link can look, not touch — review actions absent, the bug channel open.
test.skip("ops arriving at review via a complaint deep link can look, not touch", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("tab", { name: "Me" }).click();
  await page.getByTestId("role-ops").click();
  // travel by chord + context link only — a goto would reset the session
  await page.keyboard.press("g");
  await page.keyboard.press("c");
  await expect(page).toHaveURL(/\/complaints/);
  await page.getByTestId("complaint-open-cmp_1").click();
  await expect(page).toHaveURL(/\/orders\/ord_demo_2\/review/);
  await expect(page.getByTestId("sel-label")).toBeVisible();
  // the field is in context, but review actions belong to review roles:
  // no confirm/correct/escalate, no pass — the bug channel stays open
  await expect(page.getByTestId("act-confirm")).toHaveCount(0);
  await expect(page.getByTestId("act-correct")).toHaveCount(0);
  await expect(page.getByTestId("act-escalate")).toHaveCount(0);
  await expect(page.getByText("Pass — say why")).toHaveCount(0);
  await expect(page.getByText("Report pipeline bug")).toBeVisible();
});
